import pandas as pd

def clean_data(filepath):
    try:
        df = pd.read_csv(filepath)
        # 결측치 제거 및 기본 정제
        df_cleaned = df.dropna()
        return df_cleaned
    except Exception as e:
        print(f'Error processing data: {e}')
        return None
