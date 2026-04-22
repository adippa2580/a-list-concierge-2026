#!/usr/bin/env python3
"""Flatten PNG alpha channel to solid black background using only stdlib + zlib."""
import struct, zlib, sys

def read_png(path):
    with open(path, 'rb') as f:
        data = f.read()
    assert data[:8] == b'\x89PNG\r\n\x1a\n', "Not a PNG"
    chunks = []
    i = 8
    while i < len(data):
        length = struct.unpack('>I', data[i:i+4])[0]
        ctype = data[i+4:i+8]
        cdata = data[i+8:i+8+length]
        chunks.append((ctype, cdata))
        i += 12 + length
    return chunks

def write_png(path, chunks):
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n')
        for ctype, cdata in chunks:
            f.write(struct.pack('>I', len(cdata)))
            f.write(ctype)
            f.write(cdata)
            crc = zlib.crc32(ctype + cdata) & 0xffffffff
            f.write(struct.pack('>I', crc))

def flatten_alpha(src, dst):
    chunks = read_png(src)
    
    # Parse IHDR
    ihdr = dict(zip(['w','h','bd','ct','cm','fm','im'], 
                    struct.unpack('>IIBBBBB', chunks[0][1])))
    w, h = ihdr['w'], ihdr['h']
    color_type = ihdr['ct']  # 6 = RGBA, 2 = RGB, 4 = GA, 0 = Gray
    
    print(f"Source: {w}x{h}, color_type={color_type}")
    
    # Decompress IDAT
    idat_data = b''.join(c for t,c in chunks if t == b'IDAT')
    raw = zlib.decompress(idat_data)
    
    # Process scanlines
    if color_type == 6:  # RGBA
        bpp = 4
    elif color_type == 2:  # RGB - no alpha, just copy
        print("No alpha channel — copying as-is with resize")
        import shutil; shutil.copy(src, dst)
        return
    elif color_type == 4:  # Grayscale+Alpha
        bpp = 2
    else:
        print(f"Unsupported color type {color_type}")
        return
    
    stride = w * bpp + 1  # +1 for filter byte
    new_raw = bytearray()
    
    for y in range(h):
        row_start = y * stride
        filt = raw[row_start]
        new_raw.append(0)  # no filter
        for x in range(w):
            px = row_start + 1 + x * bpp
            if color_type == 6:
                r, g, b, a = raw[px], raw[px+1], raw[px+2], raw[px+3]
                # Blend onto black: out = src * alpha/255
                r = (r * a) // 255
                g = (g * a) // 255
                b = (b * a) // 255
                new_raw.extend([r, g, b])
            elif color_type == 4:
                gray, a = raw[px], raw[px+1]
                gray = (gray * a) // 255
                new_raw.extend([gray, gray, gray])
    
    # Build new IHDR with RGB color type (2)
    new_ihdr_data = struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)
    
    # Compress new IDAT
    new_idat = zlib.compress(bytes(new_raw), 9)
    
    # Build output chunks
    out_chunks = [(b'IHDR', new_ihdr_data), (b'IDAT', new_idat), (b'IEND', b'')]
    write_png(dst, out_chunks)
    print(f"Saved: {dst}")

src = '/Users/adpspare/Documents/Documents - ADP\'s MacBook Air/ALIST/a-list-2026-new/public/icon-512.png'
dst = '/Users/adpspare/Documents/Documents - ADP\'s MacBook Air/ALIST/a-list-2026-new/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png'
flatten_alpha(src, dst)
