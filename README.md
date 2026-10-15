# KARATULA

## Version Notes

- `V1.3` Added gradient options for sign background and object fill.
- `V1.4` Added copy, paste, and duplicate keyboard shortcuts.
- `V1.5` Added Ruler and Lock feature.
- `V1.6` Added browser autosave, refresh restore, toolbar reset, clipboard image paste, image background remover, smoother image edge cleanup, gradient angle controls, and image-only properties.
- `V1.6.1` Added bottom-right canvas zoom controls with draggable panning while zoomed.


## Features

- Custom sign size, defaulting to `1920px x 720px`
- Black default sign board with editable background colors
- Optional gradient background for the sign board
- Adjustable gradient angle for sign backgrounds, text, and shapes
- Editable route text with custom Filipino-inspired fonts
- Text styling: font, size, bold, italic, alignment, spacing, outline, opacity, rotation
- Text warp presets like Arc, Arch, Bulge, Wave, FishEye, Squeeze, and Twist
- Text curve and distort controls
- Fill gradients for selected text and shapes
- Autosave in the browser with restore after refresh
- Shape picker with searchable shapes
- Image upload and direct clipboard paste from copied web images
- Image background remover with white tolerance and edge soften controls
- Image-specific properties panel without text-only controls
- Layer controls for moving objects forward/backward
- Right-click object locking to prevent accidental edits or movement
- Toolbar reset button to clear the full board with confirmation
- Bottom-right zoom controls with draggable canvas panning while zoomed
- Export to PNG, PDF, and print
- Export to JPG
- Undo and redo
- Optional ruler with px marks

## Keyboard Shortcuts

- `Ctrl/Cmd + Z` undo
- `Ctrl/Cmd + Y` redo
- `Ctrl/Cmd + C` copy selected object(s)
- `Ctrl/Cmd + V` paste copied object(s)
- `Ctrl/Cmd + V` paste copied images from the browser
- `Ctrl/Cmd + D` duplicate selected object(s)
- `Delete` or `Backspace` remove selected object(s)


## Plan soon
- Street Sign


## Editor improvements

- Save and open editable JSON project files; opening a project can be undone.
- Layers panel: select, name, hide/show, lock/unlock, and reorder objects.
- Align selections to the six board edges/centers, flip horizontally/vertically, and duplicate.
- Ctrl/Cmd+A selects visible unlocked objects. Arrow keys nudge by one editor unit; Shift+Arrow nudges by ten. Ctrl/Cmd+Shift+Z redoes.
- Undo preserves sign dimensions and custom object settings. Paste, delete, and reset are single undo steps.
- PNG downloads match the requested dimensions; PDF uses corrected pixel-to-page scaling.
- Oversized exports and invalid project files show an error in the toolbar. Autosave failures are visible.
- Reset clears the artwork and background while preserving sign dimensions.

Run locally with `npm run dev`. Verify with `npm test`, `npm run lint`, and `npm run build`.


## Artwork tools

The editing toolbar above the board now has Move/select, Brush, and Stroke eraser.
Brush supports color, size, and opacity. Strokes are separate layers, saved in project files, and undoable.
Stroke eraser removes an entire unlocked brush stroke when clicked; it is not a pixel eraser.
The brush also has a Spray style; spray strokes stay editable as layers.

Select an uploaded image to reveal brightness, contrast, saturation, blur, grayscale, sepia, and invert.
Image adjustments also include Vibrance, Hue, and Pixelate.
Uploaded images can use editable rectangle or ellipse masks with inset and inversion; cropping updates the mask to fit.
Select an image, choose Rectangle mask above the board, then drag a rectangle on the canvas to make an image-local selection mask.
Crop trims percentages from each image edge, with a reset to restore the original crop.
Select multiple objects to Group them; select a group to Ungroup it.
Select one layer to set its blend mode, including Multiply, Screen, and Overlay.

Tool shortcuts: **V** Move/select, **B** Brush, **E** Stroke eraser, **Escape** return to selection. Shortcuts are ignored while typing.
