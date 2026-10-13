// Create icons in different sizes (16x16, 48x48, 128x128)
const canvas = document.createElement('canvas');
const ctx = canvas.getContext('2d');

function generateIcon(size: number): string {
  canvas.width = size;
  canvas.height = size;
  
  if (ctx) {
    // Draw a simple "A11y" icon
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = 'white';
    ctx.font = `${size/2}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', size/2, size/2);
  }
  
  return canvas.toDataURL();
}

export const icons = {
  icon16: generateIcon(16),
  icon48: generateIcon(48),
  icon128: generateIcon(128)
}; 