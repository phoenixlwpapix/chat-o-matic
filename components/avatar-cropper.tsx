"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Check, Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DEFAULT_CROP_SIZE = 320;
const OUTPUT_SIZE = 256;

interface Size {
  width: number;
  height: number;
}

interface Position {
  x: number;
  y: number;
}

interface AvatarCropperProps {
  imageUrl: string;
  onCancel: () => void;
  onConfirm: (avatar: string) => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function AvatarCropper({
  imageUrl,
  onCancel,
  onConfirm,
}: AvatarCropperProps) {
  const imageRef = useRef<HTMLImageElement>(null);
  const cropAreaRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dragStartRef = useRef<Position | null>(null);
  const positionStartRef = useRef<Position>({ x: 0, y: 0 });
  const [imageSize, setImageSize] = useState<Size | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [cropSize, setCropSize] = useState(DEFAULT_CROP_SIZE);

  const baseScale = useMemo(() => {
    if (!imageSize) return 1;
    return Math.max(
      cropSize / imageSize.width,
      cropSize / imageSize.height,
    );
  }, [cropSize, imageSize]);
  const scale = baseScale * zoom;
  const displaySize = imageSize
    ? { width: imageSize.width * scale, height: imageSize.height * scale }
    : null;

  const clampPosition = useCallback(
    (nextPosition: Position, nextZoom = zoom) => {
      if (!imageSize) return nextPosition;
      const nextScale = baseScale * nextZoom;
      const maxX = Math.max(0, (imageSize.width * nextScale - cropSize) / 2);
      const maxY = Math.max(0, (imageSize.height * nextScale - cropSize) / 2);
      return {
        x: clamp(nextPosition.x, -maxX, maxX),
        y: clamp(nextPosition.y, -maxY, maxY),
      };
    },
    [baseScale, cropSize, imageSize, zoom],
  );

  useEffect(() => {
    const cropArea = cropAreaRef.current;
    if (!cropArea) return;
    const observer = new ResizeObserver(([entry]) => {
      setCropSize(entry.contentRect.width);
    });
    observer.observe(cropArea);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const focusFrame = requestAnimationFrame(() => closeButtonRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onCancel();
      }
    };
    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      previousFocus?.focus();
    };
  }, [onCancel]);

  const updateZoom = (nextZoom: number) => {
    const boundedZoom = clamp(nextZoom, 1, 3);
    setZoom(boundedZoom);
    setPosition((current) => clampPosition(current, boundedZoom));
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragStartRef.current = { x: event.clientX, y: event.clientY };
    positionStartRef.current = position;
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragStartRef.current) return;
    setPosition(
      clampPosition({
        x: positionStartRef.current.x + event.clientX - dragStartRef.current.x,
        y: positionStartRef.current.y + event.clientY - dragStartRef.current.y,
      }),
    );
  };

  const stopDragging = () => {
    dragStartRef.current = null;
  };

  const createAvatar = () => {
    const image = imageRef.current;
    if (!image || !imageSize) return;

    const sourceSize = cropSize / scale;
    const sourceX = imageSize.width / 2 - sourceSize / 2 - position.x / scale;
    const sourceY = imageSize.height / 2 - sourceSize / 2 - position.y / scale;
    const canvas = document.createElement("canvas");
    canvas.width = OUTPUT_SIZE;
    canvas.height = OUTPUT_SIZE;
    const context = canvas.getContext("2d");
    if (!context) return;

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceSize,
      sourceSize,
      0,
      0,
      OUTPUT_SIZE,
      OUTPUT_SIZE,
    );
    onConfirm(canvas.toDataURL("image/webp", 0.9));
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/65 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="avatar-cropper-title"
        className="w-full max-w-[430px] overflow-hidden rounded-2xl border-[3px]"
        style={{
          borderColor: "var(--border-color)",
          backgroundColor: "var(--settings-panel-bg)",
          color: "var(--settings-option-text)",
          boxShadow: "8px 8px 0px 0px rgba(var(--shadow-color), 1)",
        }}
      >
        <header
          className="flex items-center justify-between border-b-2 px-4 py-3"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--header-bg)",
            color: "var(--header-text)",
          }}
        >
          <div>
            <h3 id="avatar-cropper-title" className="text-base font-black">
              裁剪头像
            </h3>
            <p className="mt-0.5 text-[10px] font-bold opacity-65">
              拖动图片并缩放，选择合适区域
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onCancel}
            className="grid h-8 w-8 place-items-center rounded-lg border-2"
            style={{ borderColor: "var(--border-color)" }}
            aria-label="取消裁剪"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="p-4 sm:p-5">
          <div
            ref={cropAreaRef}
            className="relative mx-auto aspect-square w-full max-w-80 touch-none cursor-grab overflow-hidden rounded-xl border-[3px] active:cursor-grabbing"
            style={{
              borderColor: "var(--border-color)",
              backgroundColor: "var(--settings-option-bg)",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={stopDragging}
            onPointerCancel={stopDragging}
          >
            {/* A native image preserves blob URLs and natural dimensions for canvas cropping. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={imageUrl}
              alt="待裁剪头像"
              draggable={false}
              onLoad={(event) => {
                setImageSize({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                });
                setPosition({ x: 0, y: 0 });
                setZoom(1);
              }}
              onError={onCancel}
              className="pointer-events-none absolute left-1/2 top-1/2 max-w-none select-none"
              style={
                displaySize
                  ? {
                      width: displaySize.width,
                      height: displaySize.height,
                      transform: `translate(calc(-50% + ${position.x}px), calc(-50% + ${position.y}px))`,
                    }
                  : { opacity: 0 }
              }
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-full"
              style={{ boxShadow: "0 0 0 999px rgba(0, 0, 0, 0.48)" }}
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute inset-0 rounded-full border-2 border-white/90"
              aria-hidden="true"
            />
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Minus className="h-4 w-4 shrink-0" aria-hidden="true" />
            <input
              type="range"
              min="1"
              max="3"
              step="0.01"
              value={zoom}
              onChange={(event) => updateZoom(Number(event.target.value))}
              className="w-full accent-current"
              aria-label="头像缩放"
            />
            <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
          </div>
        </div>

        <footer
          className="flex justify-end gap-2 border-t-2 px-4 py-3"
          style={{
            borderColor: "var(--border-color)",
            backgroundColor: "var(--card-footer-bg)",
          }}
        >
          <Button type="button" variant="outline" size="sm" onClick={onCancel}>
            取消
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={createAvatar}
            disabled={!imageSize}
            style={{
              backgroundColor: "var(--header-bg)",
              color: "var(--header-text)",
              borderColor: "var(--border-color)",
            }}
          >
            <Check className="h-4 w-4" />
            使用头像
          </Button>
        </footer>
      </section>
    </div>
  );
}
