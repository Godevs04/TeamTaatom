const Jimp = require('jimp-compact');
const path = require('path');

const assetsToCrop = [
  '../assets/splash-icon.png',
  '../assets/splash.png',
  '../assets/icon.png',
  '../assets/icon-1024.png'
];

async function cropAll() {
  for (const asset of assetsToCrop) {
    const assetPath = path.join(__dirname, asset);
    console.log(`Processing asset: ${assetPath}`);
    try {
      const image = await Jimp.read(assetPath);
      const originalW = image.bitmap.width;
      const originalH = image.bitmap.height;
      
      // First autocrop to trim all transparent edges
      image.autocrop(false);
      
      // Make it perfectly square (except splash.png which is a full screen background image)
      if (asset !== '../assets/splash.png') {
        const maxDim = Math.max(image.bitmap.width, image.bitmap.height);
        const squareImage = new Jimp(maxDim, maxDim, 0x00000000); // transparent background
        
        const x = Math.floor((maxDim - image.bitmap.width) / 2);
        const y = Math.floor((maxDim - image.bitmap.height) / 2);
        squareImage.composite(image, x, y);
        
        console.log(`Autocropped ${asset} and squared: from ${originalW}x${originalH} to ${maxDim}x${maxDim}`);
        await squareImage.writeAsync(assetPath);
      } else {
        console.log(`Autocropped ${asset}: from ${originalW}x${originalH} to ${image.bitmap.width}x${image.bitmap.height}`);
        await image.writeAsync(assetPath);
      }
      
      console.log(`Successfully updated ${asset}`);
    } catch (err) {
      console.error(`Error processing ${asset}:`, err);
    }
  }
}

cropAll().then(() => console.log('Done autocropping!'));
