"""HSV-based plant leaf disease analysis — ported from Phase 1."""

from __future__ import annotations

import time
from enum import Enum

import cv2
import numpy as np

# ---------------------------------------------------------------------------
# HSV thresholds (byte-identical to agrosmart-fase-1/analise_plantas.py)
# ---------------------------------------------------------------------------
LOWER_GREEN = np.array([35, 40, 40])
UPPER_GREEN = np.array([85, 255, 255])
LOWER_YELLOW = np.array([15, 40, 40])
UPPER_YELLOW = np.array([35, 255, 255])
LOWER_BROWN = np.array([5, 40, 30])
UPPER_BROWN = np.array([20, 255, 200])
KERNEL = np.ones((5, 5), np.uint8)
MIN_CONTOUR_AREA = 100


# ---------------------------------------------------------------------------
# Severity classification
# ---------------------------------------------------------------------------


class Severity(str, Enum):
    HEALTHY = "healthy"
    BEGINNING = "beginning"
    DISEASED = "diseased"


SEVERITY_LABELS_PT: dict[Severity, str] = {
    Severity.HEALTHY: "Planta saudável",
    Severity.BEGINNING: "Possível início de doença",
    Severity.DISEASED: "Planta doente",
}


def classify_severity(pct: float) -> Severity:
    if pct < 5:
        return Severity.HEALTHY
    if pct < 15:
        return Severity.BEGINNING
    return Severity.DISEASED


# ---------------------------------------------------------------------------
# Analysis entry point
# ---------------------------------------------------------------------------


def analyze(image_path: str, output_path: str) -> dict:
    """Run HSV-based leaf analysis on an image.

    Args:
        image_path: Path to the input image file.
        output_path: Path to write the annotated (red bounding boxes) image.

    Returns:
        Dict with severity, affected percentage, pixel counts, bounding boxes,
        and processing time.
    """
    t0 = time.perf_counter()

    img_bgr = cv2.imread(image_path)
    if img_bgr is None:
        raise ValueError(f"cv2.imread failed for {image_path}")

    hsv = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2HSV)

    # --- Leaf mask (green region) ---
    green_mask = cv2.inRange(hsv, LOWER_GREEN, UPPER_GREEN)
    green_mask = cv2.morphologyEx(green_mask, cv2.MORPH_CLOSE, KERNEL, iterations=2)
    green_mask = cv2.morphologyEx(green_mask, cv2.MORPH_OPEN, KERNEL, iterations=1)

    leaf_pixels = int(cv2.countNonZero(green_mask))

    if leaf_pixels == 0:
        elapsed = (time.perf_counter() - t0) * 1000.0
        # Write original as annotated (no boxes to draw)
        cv2.imwrite(output_path, img_bgr)
        severity = Severity.HEALTHY
        return {
            "severity": severity.value,
            "severity_label_pt": SEVERITY_LABELS_PT[severity],
            "affected_pct": 0.0,
            "leaf_pixels": 0,
            "diseased_pixels": 0,
            "bounding_boxes": [],
            "processing_ms": round(elapsed, 2),
        }

    # --- Diseased region (yellow + brown WITHIN the leaf area) ---
    yellow_mask = cv2.inRange(hsv, LOWER_YELLOW, UPPER_YELLOW)
    brown_mask = cv2.inRange(hsv, LOWER_BROWN, UPPER_BROWN)

    diseased_mask = cv2.bitwise_or(yellow_mask, brown_mask)
    # Only count diseased pixels that fall INSIDE the leaf region
    diseased_mask = cv2.bitwise_and(diseased_mask, green_mask)
    diseased_mask = cv2.morphologyEx(diseased_mask, cv2.MORPH_CLOSE, KERNEL, iterations=2)
    diseased_mask = cv2.morphologyEx(diseased_mask, cv2.MORPH_OPEN, KERNEL, iterations=1)

    diseased_pixels = int(cv2.countNonZero(diseased_mask))

    # --- Affected percentage (of leaf area) ---
    affected_pct = min((diseased_pixels / leaf_pixels) * 100.0, 100.0) if leaf_pixels > 0 else 0.0

    severity = classify_severity(affected_pct)

    # --- Contours and bounding boxes ---
    contours, _ = cv2.findContours(
        diseased_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )

    bounding_boxes: list[dict] = []
    annotated = img_bgr.copy()
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < MIN_CONTOUR_AREA:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        bounding_boxes.append(
            {"x": int(x), "y": int(y), "w": int(w), "h": int(h), "area_px": int(area)}
        )
        cv2.rectangle(annotated, (x, y), (x + w, y + h), (0, 0, 255), 2)

    cv2.imwrite(output_path, annotated)

    elapsed = (time.perf_counter() - t0) * 1000.0

    return {
        "severity": severity.value,
        "severity_label_pt": SEVERITY_LABELS_PT[severity],
        "affected_pct": round(affected_pct, 2),
        "leaf_pixels": leaf_pixels,
        "diseased_pixels": diseased_pixels,
        "bounding_boxes": bounding_boxes,
        "processing_ms": round(elapsed, 2),
    }
