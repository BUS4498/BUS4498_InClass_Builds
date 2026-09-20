# Synthetic teaching tool. Requires Python 3; standard library only.
# Run: python scripts/sum_minutes.py 60 20
# Expected output: {"total_minutes": 80.0}
import json
import math
import sys

try:
    values = [float(value) for value in sys.argv[1:]]
    if not values or any(not math.isfinite(value) or value < 0 for value in values):
        raise ValueError("Supply one or more finite, nonnegative durations.")
    total = sum(values)
    if not math.isfinite(total):
        raise ValueError("Total duration is too large.")
    print(json.dumps({"total_minutes": total}, allow_nan=False))
except ValueError as error:
    print(str(error), file=sys.stderr)
    sys.exit(2)
