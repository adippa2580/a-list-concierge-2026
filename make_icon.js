const sharp = require('sharp');
const path = require('path');

const src = path.join(__dirname, 'public/icon-512.png');
const dest = path.join(__dirname, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');

sharp(src)
  .resize(1024, 1024)
  .flatten({ background: { r: 0, g: 0, b: 0 } })
  .toFormat('png')
  .toFile(dest)
  .then(() => console.log('Icon saved to:', dest))
  .catch(err => {
    // sharp not available, try sips
    console.log('sharp failed, trying sips...');
    const { execSync } = require('child_process');
    execSync(`sips -z 1024 1024 "${src}" --out "${dest}"`);
    console.log('Icon saved via sips');
  });
