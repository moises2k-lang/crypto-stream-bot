#!/usr/bin/env python3
"""
Exchange Proxy Server for Binance and Bybit
Bypasses geo-blocking by routing requests through this server
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import ccxt
import os
from functools import wraps

app = Flask(__name__)
CORS(app)

# Security: API key for authenticating requests
API_KEY = os.environ.get('PROXY_API_KEY', 'change-this-secret-key')

def require_api_key(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        auth_header = request.headers.get('Authorization', '')
        if not auth_header.startswith('Bearer '):
            return jsonify({'error': 'Missing or invalid authorization'}), 401
        
        token = auth_header.replace('Bearer ', '')
        if token != API_KEY:
            return jsonify({'error': 'Invalid API key'}), 401
        
        return f(*args, **kwargs)
    return decorated_function

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'ok', 'service': 'exchange-proxy'})

@app.route('/balance', methods=['POST'])
@require_api_key
def get_balance():
    """
    Fetch balance from exchange
    Expected body: {
        "exchange": "binance" or "bybit",
        "apiKey": "...",
        "apiSecret": "...",
        "accountType": "spot" or "unified" (for Bybit)
    }
    """
    try:
        data = request.get_json()
        
        exchange_name = data.get('exchange', '').lower()
        api_key = data.get('apiKey')
        api_secret = data.get('apiSecret')
        account_type = data.get('accountType', 'spot')
        
        if not all([exchange_name, api_key, api_secret]):
            return jsonify({'error': 'Missing required fields'}), 400
        
        # Initialize exchange
        if exchange_name == 'binance':
            exchange = ccxt.binance({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
            })
        elif exchange_name == 'bybit':
            exchange = ccxt.bybit({
                'apiKey': api_key,
                'secret': api_secret,
                'enableRateLimit': True,
            })
        else:
            return jsonify({'error': f'Unsupported exchange: {exchange_name}'}), 400
        
        # Fetch balance
        balance = exchange.fetch_balance()
        
        # Extract USDT balance
        usdt_balance = 0.0
        if 'USDT' in balance.get('total', {}):
            usdt_balance = float(balance['total']['USDT'])
        elif 'total' in balance and 'USDT' in balance['total']:
            usdt_balance = float(balance['total']['USDT'])
        
        return jsonify({
            'success': True,
            'balance': usdt_balance,
            'exchange': exchange_name,
            'accountType': account_type,
            'fullBalance': balance.get('total', {})
        })
        
    except ccxt.AuthenticationError as e:
        return jsonify({
            'success': False,
            'error': 'Authentication failed',
            'details': str(e)
        }), 401
    except ccxt.NetworkError as e:
        return jsonify({
            'success': False,
            'error': 'Network error',
            'details': str(e)
        }), 503
    except Exception as e:
        return jsonify({
            'success': False,
            'error': 'Internal server error',
            'details': str(e)
        }), 500

@app.route('/test-connection', methods=['POST'])
@require_api_key
def test_connection():
    """Test connection to exchange without fetching balance"""
    try:
        data = request.get_json()
        exchange_name = data.get('exchange', '').lower()
        
        if exchange_name == 'binance':
            exchange = ccxt.binance()
            markets = exchange.fetch_markets()
            return jsonify({
                'success': True,
                'exchange': exchange_name,
                'markets_count': len(markets)
            })
        elif exchange_name == 'bybit':
            exchange = ccxt.bybit()
            markets = exchange.fetch_markets()
            return jsonify({
                'success': True,
                'exchange': exchange_name,
                'markets_count': len(markets)
            })
        else:
            return jsonify({'error': f'Unsupported exchange: {exchange_name}'}), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=False)
