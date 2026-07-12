import os
from datetime import timedelta

import pandas as pd
from sklearn.ensemble import IsolationForest
from sqlalchemy import create_engine

WINDOW_HOURS = 6
CONTAMINATION = 0.05  # expected fraction of "unusual" windows — a rough prior, not a measured rate
FEATURE_COLS = [
    "transaction_count",
    "amount_mean",
    "amount_std",
    "distinct_counterparties",
    "failed_ratio",
    "hour_of_day",
]


def load_transactions(engine) -> pd.DataFrame:
    query = """
        select agent_id, provider, party_id, type, amount, status, occurred_at
        from transactions
        order by agent_id, provider, occurred_at
    """
    return pd.read_sql(query, engine, parse_dates=["occurred_at"])


def build_window_features(df: pd.DataFrame) -> pd.DataFrame:
    rows = []

    for (agent_id, provider), group in df.groupby(["agent_id", "provider"]):
        group = group.set_index("occurred_at").sort_index()

        for window_end in group.index:
            window_start = window_end - timedelta(hours=WINDOW_HOURS)
            window = group.loc[window_start:window_end]
            if len(window) < 3:
                continue

            rows.append(
                {
                    "agent_id": agent_id,
                    "provider": provider,
                    "window_end": window_end,
                    "transaction_count": len(window),
                    "amount_mean": window["amount"].mean(),
                    "amount_std": window["amount"].std(ddof=0),
                    "distinct_counterparties": window["party_id"].nunique(),
                    "failed_ratio": (window["status"] == "failed").mean(),
                    "hour_of_day": window_end.hour,
                }
            )

    return pd.DataFrame(rows)


def predict_transaction(model: IsolationForest, transaction: dict, recent_window: pd.DataFrame) -> dict:
    window = pd.concat([recent_window, pd.DataFrame([transaction])], ignore_index=True)

    features = {
        "transaction_count": len(window),
        "amount_mean": window["amount"].mean(),
        "amount_std": window["amount"].std(ddof=0),
        "distinct_counterparties": window["party_id"].nunique(),
        "failed_ratio": (window["status"] == "failed").mean(),
        "hour_of_day": pd.Timestamp(transaction["occurred_at"]).hour,
    }

    X = pd.DataFrame([features]).fillna(0)[FEATURE_COLS]
    anomaly_score = float(-model.score_samples(X)[0])
    fired = bool(model.predict(X)[0] == -1)

    return {"fired": fired, "anomaly_score": anomaly_score, **features}


def main():
    engine = create_engine(os.environ["DATABASE_URL"])

    print("Loading transactions...")
    transactions = load_transactions(engine)

    print("Building rolling-window features...")
    features = build_window_features(transactions)
    if features.empty:
        print("Not enough data to build any windows.")
        return

    X = features[FEATURE_COLS].fillna(0)

    print(f"Training IsolationForest on {len(X)} windows...")
    model = IsolationForest(
        n_estimators=200,
        contamination=CONTAMINATION,
        random_state=42,
    )
    model.fit(X)

    features["anomaly_score"] = -model.score_samples(X)
    features["flagged"] = model.predict(X) == -1

    top = features.sort_values("anomaly_score", ascending=False).head(20)
    print("\nMost anomalous windows:")
    print(top[["agent_id", "provider", "window_end", "anomaly_score", "flagged"] + FEATURE_COLS])


if __name__ == "__main__":
    main()
