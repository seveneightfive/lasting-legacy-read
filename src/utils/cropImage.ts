// Produces a cropped (and optionally rotated) image Blob from a source URL
// and the crop area + rotation returned by react-easy-crop.

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

function createImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // needed to read pixels from a remote (Supabase storage) URL
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', (err) => reject(err));
    img.src = url;
  });
}

function getRadianAngle(degreeValue: number) {
  return (degreeValue * Math.PI) / 180;
}

// Returns the bounding box size of a rotated rectangle
function rotateSize(width: number, height: number, rotation: number) {
  const rotRad = getRadianAngle(rotation);
  return {
    width: Math.abs(Math.cos(rotRad) * width) + Math.abs(Math.sin(rotRad) * height),
    height: Math.abs(Math.sin(rotRad) * width) + Math.abs(Math.cos(rotRad) * height),
  };
}

export async function getCroppedImageBlob(
  imageSrc: string,
  cropAreaPixels: CropArea,
  rotation = 0,
  mimeType = 'image/jpeg',
  quality = 0.92
): Promise<Blob> {
  const image = await createImage(imageSrc);

  const rotRad = getRadianAngle(rotation);
  const { width: bBoxWidth, height: bBoxHeight } = rotateSize(image.width, image.height, rotation);

  // Draw the full (rotated) source image onto an intermediate canvas
  const rotateCanvas = document.createElement('canvas');
  rotateCanvas.width = bBoxWidth;
  rotateCanvas.height = bBoxHeight;
  const rotateCtx = rotateCanvas.getContext('2d');
  if (!rotateCtx) throw new Error('Could not get canvas context');

  rotateCtx.translate(bBoxWidth / 2, bBoxHeight / 2);
  rotateCtx.rotate(rotRad);
  rotateCtx.translate(-image.width / 2, -image.height / 2);
  rotateCtx.drawImage(image, 0, 0);

  // Crop the requested area out of the rotated canvas
  const cropCanvas = document.createElement('canvas');
  cropCanvas.width = cropAreaPixels.width;
  cropCanvas.height = cropAreaPixels.height;
  const cropCtx = cropCanvas.getContext('2d');
  if (!cropCtx) throw new Error('Could not get canvas context');

  cropCtx.drawImage(
    rotateCanvas,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    cropAreaPixels.width,
    cropAreaPixels.height
  );

  return new Promise((resolve, reject) => {
    cropCanvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('Canvas is empty'));
    }, mimeType, quality);
  });
}