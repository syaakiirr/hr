import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as d3 from 'd3';

// Precompute the original land sampling once instead of blocking every visitor.
"use strict";
const pointInPolygon = (point, polygon) => {
    const [x, y] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];
        if (yi > y !== yj > y &&
            x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
            inside = !inside;
        }
    }
    return inside;
};
const pointInFeature = (point, feature) => {
    const geom = feature.geometry;
    if (geom.type === "Polygon") {
        const coords = geom.coordinates;
        if (!pointInPolygon(point, coords[0]))
            return false;
        for (let i = 1; i < coords.length; i++) {
            if (pointInPolygon(point, coords[i]))
                return false;
        }
        return true;
    }
    else if (geom.type === "MultiPolygon") {
        for (const coords of geom.coordinates) {
            if (pointInPolygon(point, coords[0])) {
                let inHole = false;
                for (let i = 1; i < coords.length; i++) {
                    if (pointInPolygon(point, coords[i])) {
                        inHole = true;
                        break;
                    }
                }
                if (!inHole)
                    return true;
            }
        }
        return false;
    }
    return false;
};
const generateDotsInPolygon = (feature, density = 16) => {
    const points = [];
    const bounds = d3.geoBounds(feature);
    const [[minLng, minLat], [maxLng, maxLat]] = bounds;
    const step = density * 0.08;
    for (let lng = minLng; lng <= maxLng; lng += step) {
        for (let lat = minLat; lat <= maxLat; lat += step) {
            const pt = [lng, lat];
            if (pointInFeature(pt, feature)) {
                points.push(pt);
            }
        }
    }
    return points;
};

const started = performance.now();
const source = new URL('../public/data/ne_110m_land.json', import.meta.url);
const world = JSON.parse(readFileSync(source, 'utf8'));
const dots = world.features.flatMap(feature => generateDotsInPolygon(feature, 16)).map(point => point.map(value => Math.round(value * 10000) / 10000));
const result = JSON.stringify({ ...world, dots });
writeFileSync(new URL('../public/data/hero-globe.json', import.meta.url), result);
console.log(JSON.stringify({ dots: dots.length, generationMs: Math.round(performance.now() - started), bytes: Buffer.byteLength(result) }));
const parseStart = performance.now();
JSON.parse(result);
console.log('Precomputed parse: ' + (performance.now() - parseStart).toFixed(2) + 'ms');
