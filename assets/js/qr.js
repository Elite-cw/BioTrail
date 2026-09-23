/* BioTrail QR encoder - self-contained, zero-dependency.
   Implements the ISO/IEC 18004 QR algorithm for byte mode, error-correction
   level M, versions 1-10 (enough for short URLs). Written in ES5 so it works
   from file:// like the rest of the project. Exposes window.bioTrailQR.make()
   and also module.exports so it can be unit-tested from Node. */
(function () {
    "use strict";

    // Reed-Solomon over GF(256) with primitive polynomial 0x11D.
    var EXP = new Uint8Array(512);
    var LOG = new Uint8Array(256);
    (function () {
        var x = 1;
        for (var i = 0; i < 255; i += 1) {
            EXP[i] = x;
            LOG[x] = i;
            x <<= 1;
            if (x & 0x100) {
                x ^= 0x11D;
            }
        }
        for (var j = 255; j < 512; j += 1) {
            EXP[j] = EXP[j - 255];
        }
    })();

    function gfMul(a, b) {
        if (a === 0 || b === 0) {
            return 0;
        }
        return EXP[(LOG[a] + LOG[b]) % 255];
    }

    // Error-correction codewords for one data block, divisor order high -> low.
    function rsDivisor(degree) {
        // g(x) = product of (x - a^i) for i in 0..degree-1; in GF(2) fields
        // subtraction equals addition, so factors are (x + a^i).
        var poly = [1]; // low degree first: coefficient of x^0
        for (var i = 0; i < degree; i += 1) {
            var root = EXP[i]; // a^i, generator a = 2 (0x02)
            var next = new Array(poly.length + 1);
            next[0] = gfMul(poly[0], root);
            for (var k = 1; k < poly.length; k += 1) {
                next[k] = poly[k - 1] ^ gfMul(poly[k], root);
            }
            next[poly.length] = poly[poly.length - 1];
            poly = next;
        }
        poly.reverse(); // high degree first: leading coefficient is 1
        poly.shift();   // implicit in LFSR convention used by rsRemainder
        return poly;
    }

    function rsRemainder(data, divisor) {
        var result = [];
        for (var i = 0; i < divisor.length; i += 1) {
            result.push(0);
        }
        for (var b = 0; b < data.length; b += 1) {
            var factor = data[b] ^ result.shift();
            result.push(0);
            for (var j = 0; j < divisor.length; j += 1) {
                result[j] ^= gfMul(divisor[j], factor);
            }
        }
        return result;
    }

    function rsEncode(data, ecCount) {
        var divisor = rsDivisor(ecCount);
        var remainder = rsRemainder(data, divisor);
        while (remainder.length < ecCount) {
            remainder.unshift(0);
        }
        return remainder.slice(0, ecCount);
    }

    // Version parameters for error-correction level M (versions 1-10).
    var TOTAL_CW = [26, 44, 70, 100, 134, 172, 196, 242, 292, 346];
    var EC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26];
    var BLOCKS = [1, 1, 1, 2, 2, 4, 4, 4, 5, 5];
    var DATA_CW = [];
    for (var v = 0; v < 10; v += 1) {
        DATA_CW[v] = TOTAL_CW[v] - EC_PER_BLOCK[v] * BLOCKS[v];
    }
    var ALIGN = [
        [],
        [6, 18],
        [6, 22],
        [6, 26],
        [6, 30],
        [6, 34],
        [6, 22, 38],
        [6, 24, 42],
        [6, 26, 46],
        [6, 28, 50]
    ];

    function sizeFor(version) {
        return 17 + version * 4;
    }

    // Format information BCH for level M (EC level bits 00, so data = mask).
    var G15 = 0x537;
    var G15_MASK = 0x5412;
    // Version information BCH (versions 7-40 only).
    var G18 = 0x1F25;

    function bchDigit(value) {
        var digit = 0;
        while (value !== 0) {
            digit += 1;
            value >>>= 1;
        }
        return digit;
    }

    function formatBits(mask) {
        var data = mask;
        var d = data << 10;
        while (bchDigit(d) - bchDigit(G15) >= 0) {
            d ^= (G15 << (bchDigit(d) - bchDigit(G15)));
        }
        return ((data << 10) | d) ^ G15_MASK;
    }

    function versionBits(version) {
        var d = version << 12;
        while (bchDigit(d) - bchDigit(G18) >= 0) {
            d ^= (G18 << (bchDigit(d) - bchDigit(G18)));
        }
        return (version << 12) | d;
    }

    function maskFunc(mask, x, y) {
        switch (mask) {
            case 0: return (x + y) % 2 === 0;
            case 1: return y % 2 === 0;
            case 2: return x % 3 === 0;
            case 3: return (x + y) % 3 === 0;
            case 4: return (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            case 5: return ((x * y) % 2) + ((x * y) % 3) === 0;
            case 6: return (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            case 7: return (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            default: return false;
        }
    }

    function emptyGrid(size) {
        var grid = [];
        for (var i = 0; i < size; i += 1) {
            var row = [];
            for (var j = 0; j < size; j += 1) {
                row.push(false);
            }
            grid.push(row);
        }
        return grid;
    }

    function placeFinder(mod, reserved, size, top, left) {
        for (var dy = -1; dy <= 7; dy += 1) {
            for (var dx = -1; dx <= 7; dx += 1) {
                var x = left + dx;
                var y = top + dy;
                if (x < 0 || x >= size || y < 0 || y >= size) {
                    continue;
                }
                reserved[y][x] = true;
                if (dx === -1 || dx === 7 || dy === -1 || dy === 7) {
                    mod[y][x] = false;
                } else {
                    var onBorder = dx === 0 || dx === 6 || dy === 0 || dy === 6;
                    var inCenter = dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4;
                    mod[y][x] = onBorder || inCenter;
                }
            }
        }
    }

    function placeAlignment(mod, reserved, size, cx, cy) {
        for (var dy = -2; dy <= 2; dy += 1) {
            for (var dx = -2; dx <= 2; dx += 1) {
                var x = cx + dx;
                var y = cy + dy;
                if (x < 0 || x >= size || y < 0 || y >= size) {
                    continue;
                }
                reserved[y][x] = true;
                mod[y][x] = Math.max(Math.abs(dx), Math.abs(dy)) !== 1;
            }
        }
    }

    function placeFormatReserved(reserved, size) {
        for (var i = 0; i < 15; i += 1) {
            var y = i < 6 ? i : (i < 8 ? i + 1 : size - 15 + i);
            reserved[y][8] = true;
        }
        for (var j = 0; j < 15; j += 1) {
            var x = j < 8 ? size - 1 - j : (j < 9 ? 7 : 15 - j - 1);
            reserved[8][x] = true;
        }
        reserved[size - 8][8] = true;
    }

    function placeFormatInfo(mod, size, bits) {
        for (var i = 0; i < 15; i += 1) {
            var value = ((bits >>> i) & 1) === 1;
            if (i < 6) {
                mod[i][8] = value;
            } else if (i < 8) {
                mod[i + 1][8] = value;
            } else {
                mod[size - 15 + i][8] = value;
            }
        }
        for (var j = 0; j < 15; j += 1) {
            var value2 = ((bits >>> j) & 1) === 1;
            if (j < 8) {
                mod[8][size - 1 - j] = value2;
            } else if (j < 9) {
                mod[8][15 - j - 1 + 1] = value2;
            } else {
                mod[8][15 - j - 1] = value2;
            }
        }
        mod[size - 8][8] = true;
    }

    function placeFunctionPatterns(mod, reserved, size, alignment, version) {
        placeFinder(mod, reserved, size, 0, 0);
        placeFinder(mod, reserved, size, 0, size - 7);
        placeFinder(mod, reserved, size, size - 7, 0);

        placeVersionInfo(mod, reserved, size, version);

        for (var x = 8; x <= size - 9; x += 1) {
            reserved[6][x] = true;
            mod[6][x] = x % 2 === 0;
        }
        for (var y = 8; y <= size - 9; y += 1) {
            reserved[y][6] = true;
            mod[y][6] = y % 2 === 0;
        }

        var last = alignment.length - 1;
        for (var i = 0; i < alignment.length; i += 1) {
            for (var j = 0; j < alignment.length; j += 1) {
                if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) {
                    continue;
                }
                placeAlignment(mod, reserved, size, alignment[j], alignment[i]);
            }
        }

        placeFormatReserved(reserved, size);
    }

    // Versions 7-40 carry an 18-bit version information block in two
    // 6x3 rectangles (top-right and bottom-left). Must be written AND
    // reserved so data placement skips those cells.
    function placeVersionInfo(mod, reserved, size, version) {
        if (version < 7) {
            return;
        }
        var bits = versionBits(version);
        for (var i = 0; i < 18; i += 1) {
            var dark = ((bits >>> i) & 1) === 1;
            // Bottom-left block: rows (size-11)+/cols from i%3 and floor(i/3)
            var y1 = size - 11 + (i % 3);
            var x1 = Math.floor(i / 3);
            if (x1 < size && y1 >= 0) {
                reserved[y1][x1] = true;
                if (dark) {
                    mod[y1][x1] = true;
                }
            }
            // Top-right block: rows from floor(i/3), cols (size-11)+
            var y2 = Math.floor(i / 3);
            var x2 = size - 11 + (i % 3);
            if (y2 < size && x2 < size) {
                reserved[y2][x2] = true;
                if (dark) {
                    mod[y2][x2] = true;
                }
            }
        }
    }

    function placeData(mod, reserved, size, bits, mask) {
        var index = 0;
        for (var right = size - 1; right >= 1; right -= 2) {
            if (right === 6) {
                right = 5;
            }
            for (var vert = 0; vert < size; vert += 1) {
                for (var j = 0; j < 2; j += 1) {
                    var x = right - j;
                    var upward = ((right + 1) & 2) === 0;
                    var y = upward ? size - 1 - vert : vert;
                    if (!reserved[y][x] && index < bits.length) {
                        var raw = bits[index];
                        index += 1;
                        mod[y][x] = ((raw ^ (maskFunc(mask, x, y) ? 1 : 0)) & 1) === 1;
                    }
                }
            }
        }
    }

    function penalty(matrix) {
        var size = matrix.length;
        var total = 0;

        for (var i = 0; i < size; i += 1) {
            var runColor = matrix[i][0] ? 1 : 0;
            var runLength = 1;
            for (var j = 1; j < size; j += 1) {
                var color = matrix[i][j] ? 1 : 0;
                if (color === runColor) {
                    runLength += 1;
                } else {
                    if (runLength >= 5) { total += 3 + runLength - 5; }
                    runColor = color;
                    runLength = 1;
                }
            }
            if (runLength >= 5) { total += 3 + runLength - 5; }

            runColor = matrix[0][i] ? 1 : 0;
            runLength = 1;
            for (var j2 = 1; j2 < size; j2 += 1) {
                var color2 = matrix[j2][i] ? 1 : 0;
                if (color2 === runColor) {
                    runLength += 1;
                } else {
                    if (runLength >= 5) { total += 3 + runLength - 5; }
                    runColor = color2;
                    runLength = 1;
                }
            }
            if (runLength >= 5) { total += 3 + runLength - 5; }
        }

        for (i = 0; i < size - 1; i += 1) {
            for (var j3 = 0; j3 < size - 1; j3 += 1) {
                if (matrix[i][j3] === matrix[i][j3 + 1] &&
                    matrix[i][j3] === matrix[i + 1][j3] &&
                    matrix[i][j3] === matrix[i + 1][j3 + 1]) {
                    total += 3;
                }
            }
        }

        var seqPos = "10111010000";
        var seqNeg = "00001011101";
        for (i = 0; i < size; i += 1) {
            for (var j4 = 0; j4 <= size - 11; j4 += 1) {
                var rowSeq = "";
                var colSeq = "";
                for (var k = 0; k < 11; k += 1) {
                    rowSeq += matrix[i][j4 + k] ? "1" : "0";
                    colSeq += matrix[j4 + k][i] ? "1" : "0";
                }
                if (rowSeq === seqPos || rowSeq === seqNeg) { total += 40; }
                if (colSeq === seqPos || colSeq === seqNeg) { total += 40; }
            }
        }

        var dark = 0;
        for (i = 0; i < size; i += 1) {
            for (var j5 = 0; j5 < size; j5 += 1) {
                if (matrix[i][j5]) { dark += 1; }
            }
        }
        var percent = (dark * 100) / (size * size);
        total += Math.floor(Math.abs(percent - 50) / 5) * 10;

        return total;
    }

    // --- Public encoding ---

    function utf8Bytes(text) {
        var bytes = [];
        for (var i = 0; i < text.length; i += 1) {
            var code = text.charCodeAt(i);
            if (code < 0x80) {
                bytes.push(code);
            } else if (code < 0x800) {
                bytes.push(0xC0 | (code >> 6), 0x80 | (code & 0x3F));
            } else if (code >= 0xD800 && code <= 0xDBFF && i + 1 < text.length) {
                var low = text.charCodeAt(i + 1);
                if (low >= 0xDC00 && low <= 0xDFFF) {
                    var full = 0x10000 + ((code - 0xD800) << 10) + (low - 0xDC00);
                    bytes.push(0xF0 | (full >> 18), 0x80 | ((full >> 12) & 0x3F),
                        0x80 | ((full >> 6) & 0x3F), 0x80 | (full & 0x3F));
                    i += 1;
                } else {
                    bytes.push(0xEF, 0xBF, 0xBD);
                }
            } else if (code >= 0xD800 && code <= 0xDFFF) {
                bytes.push(0xEF, 0xBF, 0xBD);
            } else {
                bytes.push(0xE0 | (code >> 12), 0x80 | ((code >> 6) & 0x3F), 0x80 | (code & 0x3F));
            }
        }
        return bytes;
    }

    function bitListFromBytes(bytes) {
        var bits = [];
        for (var i = 0; i < bytes.length; i += 1) {
            for (var bit = 7; bit >= 0; bit -= 1) {
                bits.push((bytes[i] >>> bit) & 1);
            }
        }
        return bits;
    }

    function make(text) {
        var source = utf8Bytes(String(text));
        var version = -1;
        var countBits = 8;
        for (var v = 0; v < 10; v += 1) {
            var charBits = v < 9 ? 8 : 16;
            var capacity = Math.floor((DATA_CW[v] * 8 - (4 + charBits)) / 8);
            if (source.length <= capacity) {
                version = v + 1;
                countBits = charBits;
                break;
            }
        }
        if (version === -1) {
            return null;
        }

        var size = sizeFor(version);
        var alignment = ALIGN[version - 1];
        var dataCodewords = DATA_CW[version - 1];
        var totalCodewords = TOTAL_CW[version - 1];
        var ecLen = EC_PER_BLOCK[version - 1];
        var numBlocks = BLOCKS[version - 1];

        var buffer = [];
        buffer.push(0, 1, 0, 0); // byte mode 0100
        for (var cb = countBits - 1; cb >= 0; cb -= 1) {
            buffer.push((source.length >>> cb) & 1);
        }
        for (var b = 0; b < source.length; b += 1) {
            for (var bit = 7; bit >= 0; bit -= 1) {
                buffer.push((source[b] >>> bit) & 1);
            }
        }

        var maxBits = dataCodewords * 8;
        var pad = maxBits - buffer.length;
        for (var z = 0; z < Math.min(4, pad); z += 1) {
            buffer.push(0);
        }
        while (buffer.length % 8 !== 0) {
            buffer.push(0);
        }
        var padByte = 0xEC;
        while (buffer.length < maxBits) {
            for (var pb = 7; pb >= 0; pb -= 1) {
                buffer.push((padByte >>> pb) & 1);
            }
            padByte = padByte === 0xEC ? 0x11 : 0xEC;
        }

        var dataBytes = [];
        for (var db = 0; db < buffer.length; db += 8) {
            var byte = 0;
            for (var k = 0; k < 8; k += 1) {
                byte = (byte << 1) | buffer[db + k];
            }
            dataBytes.push(byte);
        }

        var shortLen = Math.floor(dataCodewords / numBlocks);
        var numLong = dataCodewords % numBlocks;
        var blockData = [];
        var pointer = 0;
        for (var q = 0; q < numBlocks; q += 1) {
            // Per the ISO RS-block table, the shorter blocks come first
            // and any extra codeword goes to the final blocks only.
            var blockLen = q < numBlocks - numLong ? shortLen : shortLen + 1;
            blockData.push(dataBytes.slice(pointer, pointer + blockLen));
            pointer += blockLen;
        }
        var blockEc = [];
        for (var e = 0; e < numBlocks; e += 1) {
            blockEc.push(rsEncode(blockData[e], ecLen));
        }

        var interleaved = [];
        for (var c = 0; c <= shortLen; c += 1) {
            for (var blk = 0; blk < numBlocks; blk += 1) {
                if (c < blockData[blk].length) {
                    interleaved.push(blockData[blk][c]);
                }
            }
        }
        for (c = 0; c < ecLen; c += 1) {
            for (blk = 0; blk < numBlocks; blk += 1) {
                interleaved.push(blockEc[blk][c]);
            }
        }
        while (interleaved.length < totalCodewords) {
            interleaved.push(0);
        }

        var bits = bitListFromBytes(interleaved);

        var bestMask = 0;
        var bestModules = null;
        var bestPenalty = Infinity;
        for (var mask = 0; mask < 8; mask += 1) {
            var grid = emptyGrid(size);
            var reserved = emptyGrid(size);
            placeFunctionPatterns(grid, reserved, size, alignment, version);
            placeData(grid, reserved, size, bits, mask);
            var score = penalty(grid);
            if (score < bestPenalty) {
                bestPenalty = score;
                bestMask = mask;
                bestModules = grid;
            }
        }

        placeFormatInfo(bestModules, size, formatBits(bestMask));

        return {
            size: size,
            modules: bestModules,
            version: version,
            mask: bestMask,
            text: String(text)
        };
    }

    var api = {
        make: make,
        version: 1
    };

    if (typeof window !== "undefined") {
        window.bioTrailQR = api;
    }
    if (typeof module !== "undefined" && module.exports) {
        module.exports = api;
    }
})();