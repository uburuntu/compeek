"""Generate visual assets for compeek using Gemini Pro image generation."""

import os
from google import genai
from google.genai import types

ASSETS_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'app', 'assets')
os.makedirs(ASSETS_DIR, exist_ok=True)

client = genai.Client(api_key=os.environ["GEMINI_API_KEY"])

def generate_image(prompt, filename, aspect_ratio="1:1"):
    """Generate an image with Gemini Pro and save it."""
    print(f"Generating: {filename}...")
    try:
        response = client.models.generate_content(
            model="gemini-3-pro-image-preview",
            contents=[prompt],
            config=types.GenerateContentConfig(
                response_modalities=['TEXT', 'IMAGE'],
                image_config=types.ImageConfig(
                    aspect_ratio=aspect_ratio,
                ),
            ),
        )
        for part in response.candidates[0].content.parts:
            if part.text:
                print(f"  Model: {part.text[:80]}")
            elif part.inline_data:
                # Data comes as raw bytes, not base64
                data = part.inline_data.data
                filepath = os.path.join(ASSETS_DIR, filename)
                with open(filepath, 'wb') as f:
                    f.write(data)
                print(f"  Saved: {filepath} ({len(data):,} bytes)")
                return filepath
    except Exception as e:
        print(f"  Error: {e}")
    return None


# 1. Logo / Favicon
generate_image(
    "A minimal, flat, geometric icon for an AI desktop agent app. "
    "The design is a stylized eye shape made of clean geometric forms - the outer eye shape is indigo (#6366f1) "
    "and the iris/pupil is a bright pixel grid or digital scan pattern, suggesting computer vision and AI. "
    "The background is very dark navy-black (#0a0a0f). No text, no letters, no words. "
    "Flat design, no gradients, no shadows, no 3D effects. "
    "Think: a tech company app icon, minimal like Figma or Linear icons. "
    "Single centered icon on dark background.",
    "logo.png"
)

# 2. Empty state - Waiting for agent (DesktopViewer)
generate_image(
    "A minimal, dark-themed illustration for an empty state in a developer tool UI. "
    "Shows a stylized computer monitor outline with a subtle scanning/eye pattern inside it, "
    "suggesting an AI agent waiting to observe a desktop. "
    "Color palette: indigo (#6366f1) lines and shapes on very dark background (#0a0a0f). "
    "Clean, geometric, minimal line art style. No text. No people. "
    "Subtle dot grid or scan lines to suggest readiness. "
    "Flat design, modern SaaS aesthetic, like empty states in Linear or Vercel dashboards.",
    "empty-desktop.png"
)

# 3. Empty state - No activity yet (ActivityFeed)
generate_image(
    "A minimal, dark-themed illustration for an 'empty activity feed' state. "
    "Shows a stylized timeline or list with faded placeholder lines, "
    "with a small indigo (#6366f1) cursor or pointer waiting at the top. "
    "Color palette: muted slate-gray lines on very dark background (#0a0a0f), "
    "with one indigo accent element. "
    "Clean, geometric, minimal line art. No text. No people. "
    "Modern developer tool aesthetic, like an empty state in a dev dashboard.",
    "empty-activity.png"
)

# 4. Empty state - No thinking yet (ThinkingDisplay)
generate_image(
    "A minimal, dark-themed illustration for an 'AI thinking' empty state. "
    "Shows a stylized brain or neural network pattern made of connected dots and lines, "
    "in a dormant/waiting state - not yet activated. "
    "Color palette: muted indigo (#6366f1) nodes with dim connecting lines on very dark background (#0a0a0f). "
    "Clean, geometric, minimal. No text. No people. "
    "Suggests potential intelligence waiting to be activated. "
    "Modern, abstract, flat design.",
    "empty-thinking.png"
)

# 5. Empty state - No validation yet (ValidationReport)
generate_image(
    "A minimal, dark-themed illustration for a 'validation pending' empty state. "
    "Shows a stylized clipboard or checklist outline with empty checkbox shapes, "
    "waiting to be filled. One checkbox has a subtle indigo (#6366f1) glow suggesting readiness. "
    "Color palette: muted slate outlines on very dark background (#0a0a0f), "
    "with indigo accent. Clean, geometric, minimal line art. No text. No people. "
    "Modern developer tool aesthetic.",
    "empty-validation.png"
)

print("\nDone! All assets generated.")
