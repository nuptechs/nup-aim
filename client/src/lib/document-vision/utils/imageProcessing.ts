import type { BoundingBox } from '../types';

export function generateId(): string {
  return `dv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export async function loadImage(source: string | File | Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${e}`));
    
    if (source instanceof File || source instanceof Blob) {
      img.src = URL.createObjectURL(source);
    } else {
      img.src = source;
    }
  });
}

export function imageToCanvas(
  image: HTMLImageElement | HTMLVideoElement,
  maxWidth = 1920,
  maxHeight = 1080
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  let { width, height } = image instanceof HTMLVideoElement 
    ? { width: image.videoWidth, height: image.videoHeight }
    : { width: image.width, height: image.height };
  
  const scale = Math.min(maxWidth / width, maxHeight / height, 1);
  width *= scale;
  height *= scale;
  
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(image, 0, 0, width, height);
  
  return canvas;
}

export function canvasToBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('Failed to create blob')),
      'image/jpeg',
      quality
    );
  });
}

export function canvasToBase64(canvas: HTMLCanvasElement, quality = 0.92): string {
  return canvas.toDataURL('image/jpeg', quality);
}

export function getImageData(canvas: HTMLCanvasElement): ImageData {
  const ctx = canvas.getContext('2d')!;
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

export function applyGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
    data[i] = gray;
    data[i + 1] = gray;
    data[i + 2] = gray;
  }
  return imageData;
}

export function applyThreshold(imageData: ImageData, threshold = 128): ImageData {
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] > threshold ? 255 : 0;
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  return imageData;
}

export function detectEdges(imageData: ImageData): ImageData {
  const { width, height, data } = imageData;
  const output = new ImageData(width, height);
  const outputData = output.data;
  
  const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let gx = 0, gy = 0;
      
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const idx = ((y + ky) * width + (x + kx)) * 4;
          const gray = data[idx];
          const kernelIdx = (ky + 1) * 3 + (kx + 1);
          gx += gray * sobelX[kernelIdx];
          gy += gray * sobelY[kernelIdx];
        }
      }
      
      const magnitude = Math.min(255, Math.sqrt(gx * gx + gy * gy));
      const outIdx = (y * width + x) * 4;
      outputData[outIdx] = magnitude;
      outputData[outIdx + 1] = magnitude;
      outputData[outIdx + 2] = magnitude;
      outputData[outIdx + 3] = 255;
    }
  }
  
  return output;
}

export function findContours(edgeData: ImageData, minArea = 100): BoundingBox[] {
  const { width, height, data } = edgeData;
  const visited = new Set<number>();
  const contours: BoundingBox[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (data[idx] > 128 && !visited.has(idx)) {
        const region = floodFill(data, width, height, x, y, visited);
        if (region.area >= minArea) {
          contours.push(region.box);
        }
      }
    }
  }
  
  return mergeOverlappingBoxes(contours);
}

function floodFill(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  startX: number,
  startY: number,
  visited: Set<number>
): { box: BoundingBox; area: number } {
  const stack: [number, number][] = [[startX, startY]];
  let minX = startX, maxX = startX, minY = startY, maxY = startY;
  let area = 0;
  
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    const idx = (y * width + x) * 4;
    
    if (x < 0 || x >= width || y < 0 || y >= height) continue;
    if (visited.has(idx) || data[idx] <= 128) continue;
    
    visited.add(idx);
    area++;
    
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
    
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  
  return {
    box: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    area
  };
}

function mergeOverlappingBoxes(boxes: BoundingBox[], threshold = 10): BoundingBox[] {
  const merged: BoundingBox[] = [];
  const used = new Set<number>();
  
  for (let i = 0; i < boxes.length; i++) {
    if (used.has(i)) continue;
    
    let current = { ...boxes[i] };
    used.add(i);
    
    for (let j = i + 1; j < boxes.length; j++) {
      if (used.has(j)) continue;
      
      if (boxesOverlap(current, boxes[j], threshold)) {
        current = mergeBoxes(current, boxes[j]);
        used.add(j);
      }
    }
    
    merged.push(current);
  }
  
  return merged;
}

function boxesOverlap(a: BoundingBox, b: BoundingBox, margin = 0): boolean {
  return !(
    a.x + a.width + margin < b.x ||
    b.x + b.width + margin < a.x ||
    a.y + a.height + margin < b.y ||
    b.y + b.height + margin < a.y
  );
}

function mergeBoxes(a: BoundingBox, b: BoundingBox): BoundingBox {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return {
    x,
    y,
    width: Math.max(a.x + a.width, b.x + b.width) - x,
    height: Math.max(a.y + a.height, b.y + b.height) - y
  };
}

export function assessImageQuality(imageData: ImageData): 'low' | 'medium' | 'high' {
  const { data, width, height } = imageData;
  
  let variance = 0;
  let mean = 0;
  const pixelCount = width * height;
  
  for (let i = 0; i < data.length; i += 4) {
    mean += data[i];
  }
  mean /= pixelCount;
  
  for (let i = 0; i < data.length; i += 4) {
    variance += Math.pow(data[i] - mean, 2);
  }
  variance /= pixelCount;
  
  const stdDev = Math.sqrt(variance);
  
  if (stdDev < 30) return 'low';
  if (stdDev < 60) return 'medium';
  return 'high';
}
