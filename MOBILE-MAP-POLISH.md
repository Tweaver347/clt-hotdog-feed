# Mobile map polish

This update refines the current community map without changing Supabase or the report system.

## Improvements

- Keeps the public map constrained to the Charlotte metro area.
- Ignores malformed or far-away coordinates when calculating the public map bounds.
- Recalculates the map size after mobile layout completes, preventing the continent-wide initial view.
- Uses a closer Charlotte default view and sensible maximum zoom when fitting markers.
- Makes the dark map tiles easier to read.
- Keeps the selected-location card above the fixed bottom navigation.
- Makes the location card shorter and easier to scan on a phone.
- Keeps a selected marker visible above the location card.
- Makes neighborhood chips smoother to swipe, with visual fades at both edges.
- Compacts the mobile map heading and display switch.
- Scrolls to the top when navigating between app pages, preventing the map title from appearing beneath the sticky header.
- Tapping an empty area of the map closes the selected-location card.

## Install

Copy `styles.css` and the complete `js` folder into the project root, replacing the matching files.

## Test

1. Open the Map page on an iPhone-sized viewport.
2. Confirm the map starts around Charlotte rather than North America.
3. Tap a marker and confirm its card stays above the bottom navigation.
4. Tap empty map space and confirm the card closes.
5. Swipe the neighborhood filters horizontally.
6. Test Map/List, Near Me, Charlotte, light mode, dark mode, larger text, and reduced motion.
