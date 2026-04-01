import pandas as pd
import numpy as np
import talib as tl


def calc_smma(src: np.ndarray, length: int) -> np.ndarray:

    smma = np.full_like(src, fill_value=np.nan)
    sma = tl.SMA(src, length)

    for i in range(1, len(src)):
        smma[i] = (
            sma[i]
            if np.isnan(smma[i - 1])
            else (smma[i - 1] * (length - 1) + src[i]) / length
        )

    return smma

def calc_zlema(src: np.ndarray, length: int) -> np.ndarray:

    ema1 = tl.EMA(src, length)
    ema2 = tl.EMA(ema1, length)
    d = ema1 - ema2
    return ema1 + d


def macd(data, lengthMA, lengthSignal):
    src = (
        data["inth"].to_numpy(dtype=np.double)
        + data["intl"].to_numpy(dtype=np.double)
        + data["intc"].to_numpy(dtype=np.double)
    ) / 3
    hi = calc_smma(data["inth"].to_numpy(dtype=np.double), lengthMA)
    lo = calc_smma(data["intl"].to_numpy(dtype=np.double), lengthMA)
    mi = calc_zlema(src, lengthMA)

    md = np.full_like(mi, fill_value=np.nan)

    conditions = [mi > hi, mi < lo]
    choices = [mi - hi, mi - lo]

    md = np.select(conditions, choices, default=0)

    sb = tl.SMA(md, lengthSignal)
    sh = md - sb

    res = pd.DataFrame(
        {
            "open_time": data["time"],
            "ImpulseMACD": md,
            "ImpulseHisto": sh,
            "ImpulseMACDCDSignal": sb,
        }
    )
    return res


