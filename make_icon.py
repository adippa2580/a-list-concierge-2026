from PIL import Image
img = Image.open('/Users/adpspare/Documents/Documents - ADP\'s MacBook Air/ALIST/a-list-2026-new/public/icon-512.png').convert('RGBA')
bg = Image.new('RGBA', (1024, 1024), (0, 0, 0, 255))
img_1024 = img.resize((1024, 1024), Image.LANCZOS)
bg.paste(img_1024, (0, 0), img_1024)
final = bg.convert('RGB')
dest = '/Users/adpspare/Documents/Documents - ADP\'s MacBook Air/ALIST/a-list-2026-new/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
final.save(dest, 'PNG')
print('Icon saved:', final.size, dest)
