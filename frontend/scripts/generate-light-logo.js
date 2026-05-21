const Jimp = require('jimp-compact');
const path = require('path');

const srcPath = path.join(__dirname, '../assets/images/taatom_text_dark.png');
const destPath = path.join(__dirname, '../assets/images/taatom_text_light.png');

console.log('Reading dark logo from:', srcPath);

Jimp.read(srcPath)
  .then(image => {
    console.log('Successfully read dark logo.');
    console.log('Image dimensions:', image.bitmap.width, 'x', image.bitmap.height);
    
    // Scan the image and for any pixel that is NOT fully transparent,
    // convert it to #0F172A (R: 15, G: 23, B: 42) while retaining the original alpha channel.
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const a = this.bitmap.data[idx + 3];
      
      if (a > 0) {
        this.bitmap.data[idx] = 15;     // Red
        this.bitmap.data[idx + 1] = 23; // Green
        this.bitmap.data[idx + 2] = 42; // Blue
      }
    });
    
    console.log('Writing light logo to:', destPath);
    return image.writeAsync(destPath);
  })
  .then(() => {
    console.log('Successfully generated taatom_text_light.png!');
  })
  .catch(err => {
    console.error('Error generating light logo:', err);
    process.exit(1);
  });
