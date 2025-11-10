import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { DashboardHeader } from "@/components/DashboardHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Shield, UserX, UserCheck, Key, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Edit, ShieldOff, Trash2 } from "lucide-react";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface UserData {
  id: string;
  user_id: string;
  email: string;
  full_name?: string;
  is_active: boolean;
  created_at: string;
  user_stats: {
    total_balance: number;
    today_pnl: number;
    win_rate: number;
  } | null;
  user_roles: { role: string }[];
  trades_count: number;
  active_signals_count: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<UserData[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [passwordDialogOpen, setPasswordDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserData | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<string>("user");
  const [actionLoading, setActionLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate('/');
      return;
    }

    setCurrentUserId(user.id);

    // Check if user has admin role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roleData) {
      toast.error("Acceso denegado: Se requieren permisos de administrador");
      navigate('/');
      return;
    }

    setIsAdmin(true);
    fetchUsers();
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No session');
      }

      const { data, error } = await supabase.functions.invoke('admin-get-users', {
        body: {
          page: currentPage,
          pageSize: pageSize
        },
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setUsers(data.users || []);
      setTotalCount(data.pagination?.totalCount || 0);
      setTotalPages(data.pagination?.totalPages || 0);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast.error(error.message || "Error al cargar usuarios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchUsers();
    }
  }, [currentPage, pageSize, isAdmin]);

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('admin-update-user', {
        body: {
          userId,
          action: 'toggle_active',
          data: { isActive: !currentStatus }
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success(currentStatus ? "Usuario desactivado" : "Usuario activado");
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar usuario");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUser || !newPassword || newPassword.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('admin-update-user', {
        body: {
          userId: selectedUser.user_id,
          action: 'reset_password',
          data: { newPassword }
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success("Contraseña restablecida correctamente");
      setPasswordDialogOpen(false);
      setNewPassword("");
      setSelectedUser(null);
    } catch (error: any) {
      toast.error(error.message || "Error al restablecer contraseña");
    } finally {
      setActionLoading(false);
    }
  };

  const handleResetMFA = async (userId: string, userEmail: string) => {
    if (!confirm(`¿Estás seguro de que deseas resetear el 2FA de ${userEmail}?`)) {
      return;
    }

    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('admin-reset-mfa', {
        body: { userId },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success("2FA reseteado correctamente");
    } catch (error: any) {
      console.error('Error resetting MFA:', error);
      toast.error(error.message || "Error al resetear 2FA");
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditProfile = async () => {
    if (!selectedUser || !editFullName.trim() || !editEmail.trim()) {
      toast.error("Nombre y correo son requeridos");
      return;
    }

    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Update profile
      const { error: profileError } = await supabase.functions.invoke('admin-update-user', {
        body: {
          userId: selectedUser.user_id,
          action: 'update_profile',
          data: { 
            fullName: editFullName.trim(),
            email: editEmail.trim()
          }
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (profileError) throw profileError;

      // Update role if changed
      const currentRole = selectedUser.user_roles?.[0]?.role || 'user';
      if (editRole !== currentRole) {
        const { error: roleError } = await supabase.functions.invoke('admin-update-user', {
          body: {
            userId: selectedUser.user_id,
            action: 'update_role',
            data: { role: editRole }
          },
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
        });

        if (roleError) throw roleError;
      }

      toast.success("Perfil actualizado correctamente");
      setEditDialogOpen(false);
      setEditFullName("");
      setEditEmail("");
      setEditRole("user");
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Error al actualizar perfil");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;

    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      const { error } = await supabase.functions.invoke('admin-update-user', {
        body: {
          userId: selectedUser.user_id,
          action: 'delete_user',
          data: {}
        },
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      });

      if (error) throw error;

      toast.success("Usuario eliminado correctamente");
      setDeleteDialogOpen(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error: any) {
      toast.error(error.message || "Error al eliminar usuario");
    } finally {
      setActionLoading(false);
    }
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Verificando permisos...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <DashboardHeader />
      
      <main className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 text-primary" />
              <CardTitle>Administración de Usuarios</CardTitle>
            </div>
            <CardDescription>
              Gestiona usuarios, sus balances, operaciones y permisos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>PNL Hoy</TableHead>
                  <TableHead>Win Rate</TableHead>
                  <TableHead>Operaciones</TableHead>
                  <TableHead>Señales</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => {
                  const stats = user.user_stats;
                  const role = user.user_roles?.[0]?.role || 'user';
                  const pnlPositive = (stats?.today_pnl || 0) >= 0;
                  const isCurrentUser = user.user_id === currentUserId;

                  return (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.full_name || 'Sin nombre'}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "secondary"}>
                          {user.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={role === 'admin' ? "destructive" : "outline"}>
                          {role}
                        </Badge>
                      </TableCell>
                      <TableCell>${stats?.total_balance?.toFixed(2) || '0.00'}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-1 ${pnlPositive ? 'text-success' : 'text-danger'}`}>
                          {pnlPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                          ${stats?.today_pnl?.toFixed(2) || '0.00'}
                        </div>
                      </TableCell>
                      <TableCell>{stats?.win_rate?.toFixed(1) || '0'}%</TableCell>
                      <TableCell>{user.trades_count}</TableCell>
                      <TableCell>{user.active_signals_count}</TableCell>
                      <TableCell>
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setEditFullName(user.full_name || '');
                              setEditEmail(user.email);
                              setEditRole(role);
                              setEditDialogOpen(true);
                            }}
                            disabled={actionLoading}
                            title="Editar perfil"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {!isCurrentUser && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleActive(user.user_id, user.is_active)}
                                disabled={actionLoading}
                                title={user.is_active ? "Desactivar usuario" : "Activar usuario"}
                              >
                                {user.is_active ? <UserX className="h-4 w-4" /> : <UserCheck className="h-4 w-4" />}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  setSelectedUser(user);
                                  setDeleteDialogOpen(true);
                                }}
                                disabled={actionLoading}
                                title="Eliminar usuario permanentemente"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedUser(user);
                              setPasswordDialogOpen(true);
                            }}
                            disabled={actionLoading}
                            title="Cambiar contraseña"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleResetMFA(user.user_id, user.email)}
                            disabled={actionLoading}
                            title="Resetear 2FA"
                          >
                            <ShieldOff className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination Controls */}
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="flex items-center gap-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {users.length > 0 ? ((currentPage - 1) * pageSize) + 1 : 0} - {Math.min(currentPage * pageSize, totalCount)} de {totalCount} usuarios
                </div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="pageSize" className="text-sm">Usuarios por página:</Label>
                  <Select
                    value={pageSize.toString()}
                    onValueChange={(value) => {
                      setPageSize(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger id="pageSize" className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="5">5</SelectItem>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="25">25</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                
                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(pageNum)}
                        disabled={loading}
                        className="w-10"
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Edit Profile Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>
              Editar información de: {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="editFullName">Nombre Completo</Label>
              <Input
                id="editFullName"
                type="text"
                value={editFullName}
                onChange={(e) => setEditFullName(e.target.value)}
                placeholder="Nombre del usuario"
              />
            </div>
            <div>
              <Label htmlFor="editEmail">Correo Electrónico</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@ejemplo.com"
              />
            </div>
            <div>
              <Label htmlFor="editRole">Rol</Label>
              <Select
                value={editRole}
                onValueChange={(value) => {
                  // No permitir cambiar el rol del usuario actual si es admin
                  if (selectedUser?.user_id === currentUserId && value !== 'admin') {
                    toast.error("No puedes quitarte los permisos de administrador");
                    return;
                  }
                  setEditRole(value);
                }}
              >
                <SelectTrigger id="editRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleEditProfile} disabled={actionLoading}>
              {actionLoading ? "Guardando..." : "Guardar Cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Dialog */}
      <Dialog open={passwordDialogOpen} onOpenChange={setPasswordDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restablecer Contraseña</DialogTitle>
            <DialogDescription>
              Cambiar contraseña para: {selectedUser?.email}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="newPassword">Nueva Contraseña</Label>
              <Input
                id="newPassword"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPasswordDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleResetPassword} disabled={actionLoading}>
              {actionLoading ? "Procesando..." : "Restablecer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete User Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás completamente seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción <strong>NO se puede deshacer</strong>. Esto eliminará permanentemente la cuenta de{" "}
              <strong>{selectedUser?.email}</strong> y todos sus datos asociados:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Perfil y estadísticas</li>
                <li>Operaciones y señales</li>
                <li>Conexiones de exchange</li>
                <li>Notificaciones e historial</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={actionLoading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={actionLoading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading ? "Eliminando..." : "Sí, eliminar permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Admin;
