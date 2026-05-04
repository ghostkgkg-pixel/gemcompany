import pandas as pd

def clean_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    주어진 데이터프레임의 결측치를 제거하고 정제된 데이터를 반환합니다.
    """
    # 결측치 제거
    cleaned_df = df.dropna()
    
    # 인덱스 초기화
    cleaned_df = cleaned_df.reset_index(drop=True)
    
    return cleaned_df

if __name__ == '__main__':
    print('Data preprocessing module ready.')