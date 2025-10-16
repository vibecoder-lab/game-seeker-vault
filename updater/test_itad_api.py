#!/usr/bin/env python3
"""Test ITAD API response structure"""

import sys
import json
import requests

if len(sys.argv) < 2:
    print("Usage: python test_itad_api.py <API_KEY>")
    sys.exit(1)

api_key = sys.argv[1]

# Test with known game IDs
test_cases = [
    ('018d937f-6144-7057-ad1c-0e99a3a71797', 'Hogwarts Legacy'),  # 最安値が'-'のゲーム
    ('018d937e-f518-7166-9649-affeff72a110', 'Factorio'),  # 定価=最安値
    ('018d937f-1b0a-715e-8022-4d0a6f824679', 'Divinity: Original Sin 2'),  # 正常
]

print("=== ITAD API /games/prices/v3 レスポンス構造調査 ===\n")

for itad_id, title in test_cases:
    print(f"--- {title} ---")
    print(f"ITAD ID: {itad_id}\n")
    
    api_url = f"https://api.isthereanydeal.com/games/prices/v3?key={api_key}&country=JP"
    payload = [itad_id]
    
    try:
        response = requests.post(api_url, json=payload, timeout=10)
        response.raise_for_status()
        
        data = response.json()
        
        print("レスポンス全体:")
        print(json.dumps(data, indent=2, ensure_ascii=False))
        print()
        
        # データ構造を解析
        if isinstance(data, list) and len(data) > 0:
            game_data = data[0]
            print("取得したフィールド:")
            print(f"  - keys: {list(game_data.keys())}")
            
            if 'historyLow' in game_data:
                print(f"  - historyLow: {json.dumps(game_data['historyLow'], indent=4, ensure_ascii=False)}")
            else:
                print("  - historyLow: フィールドなし")
                
            if 'price' in game_data:
                print(f"  - price: {json.dumps(game_data['price'], indent=4, ensure_ascii=False)}")
        
        print("\n" + "="*60 + "\n")
        
    except Exception as e:
        print(f"エラー: {e}\n")
        print("="*60 + "\n")

