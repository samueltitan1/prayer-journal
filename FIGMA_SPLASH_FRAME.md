# Splash Frame - Complete Details

## Frame Information

**Node ID:** `2:778`  
**Name:** `Splash`  
**Position:** `x: -1039, y: 0`  
**Dimensions:** `393px × 852px`

---

## Structure & Hierarchy

```
Splash (2:778)
├── tl (2:779)
│   └── Position: (0, 0)
│   └── Dimensions: 392.76 × 852.35px
│
└── Container (2:780)
    └── Position: (0, 0)
    └── Dimensions: 392.76 × 852.35px
    └── Opacity: 0.988
    │
    └── SplashScreen (2:781)
        └── Position: (92.16, 327.68)
        └── Dimensions: 208.44 × 196.99px
        │
        ├── Container (2:782) - Logo Container
        │   └── Position: (48.22, 0)
        │   └── Dimensions: 112 × 81px
        │   │
        │   └── Logo (2:783)
        │       └── Position: (0, 0)
        │       └── Dimensions: 112 × 112px
        │       │
        │       ├── Vector Stroke (83:3698)
        │       │   └── Asset URL: https://www.figma.com/api/mcp/asset/17b7bb45-debd-4ee9-bc78-8d1102535cbe
        │       │   └── Dimensions: 2.8 × 62.8px
        │       │   └── Position: 6.25% top, 48.74% left
        │       │
        │       └── Vector Stroke (83:3699)
        │           └── Asset URL: https://www.figma.com/api/mcp/asset/e78d3c8f-90a5-43ca-9279-a04734c7b61a
        │           └── Position: 24.93% top, 32.34% left
        │
        └── Container (2:809) - Text Container
            └── Position: (24, 71)
            └── Dimensions: 160.46 × 61px
            │
            ├── SplashScreen (2:810) - Title Frame
            │   └── Dimensions: 160.46 × 36px
            │   │
            │   └── Text: "Prayer Journal" (2:811)
            │       └── Dimensions: 161 × 36px
            │       └── Font: Playfair Display Medium
            │       └── Size: 24px
            │       └── Color: #2f2f2f
            │       └── Line Height: 36px
            │       └── Letter Spacing: 0.24px
            │       └── Text Align: Center
            │
            └── Paragraph (2:812) - Subtitle Frame
                └── Position: (0, 40)
                └── Dimensions: 160.46 × 21px
                │
                └── Text: "Speak. Reflect. Grow." (2:813)
                    └── Position: (7.44, -0.64)
                    └── Dimensions: 147 × 21px
                    └── Font: Inter Regular
                    └── Size: 14px
                    └── Color: #6b6b6b
                    └── Line Height: 21px
                    └── Letter Spacing: 0.28px
                    └── Text Align: Center
```

---

## Design Specifications

### Colors
- **Background:** `#faf9f6` (beige/cream)
- **Title Text:** `#2f2f2f` (dark gray)
- **Subtitle Text:** `#6b6b6b` (medium gray)

### Typography

#### Title: "Prayer Journal"
- **Font Family:** Playfair Display Medium
- **Font Size:** 24px
- **Line Height:** 36px
- **Letter Spacing:** 0.24px
- **Color:** `#2f2f2f`
- **Text Align:** Center
- **Weight:** Medium (500)

#### Subtitle: "Speak. Reflect. Grow."
- **Font Family:** Inter Regular
- **Font Size:** 14px
- **Line Height:** 21px
- **Letter Spacing:** 0.28px
- **Color:** `#6b6b6b`
- **Text Align:** Center
- **Weight:** Regular (400)

### Layout
- **Container Opacity:** 0.988
- **Content Alignment:** Centered (both horizontally and vertically)
- **Logo Position:** Above text, centered
- **Text Spacing:** 4px gap between title and subtitle

### Assets

#### Logo Vectors
1. **Vector Stroke 1** (83:3698)
   - URL: `https://www.figma.com/api/mcp/asset/17b7bb45-debd-4ee9-bc78-8d1102535cbe`
   - Dimensions: 2.8 × 62.8px
   - Position: Vertical element (cross vertical bar)

2. **Vector Stroke 2** (83:3699)
   - URL: `https://www.figma.com/api/mcp/asset/e78d3c8f-90a5-43ca-9279-a04734c7b61a`
   - Position: Horizontal element (cross horizontal bar)

**Note:** Assets are stored on a remote server for 7 days and can be fetched using the provided URLs until they expire.

---

## React Native Implementation Reference

### Component Structure
```typescript
<Splash>
  <Container> // Full screen container
    <SplashScreen> // Centered content group
      <LogoContainer>
        <Logo>
          <VectorStroke1 />
          <VectorStroke2 />
        </Logo>
      </LogoContainer>
      <TextContainer>
        <Title>Prayer Journal</Title>
        <Subtitle>Speak. Reflect. Grow.</Subtitle>
      </TextContainer>
    </SplashScreen>
  </Container>
</Splash>
```

### Key Styling Values
- Background: `#faf9f6`
- Container opacity: `0.988`
- Logo container: `112 × 81px`
- Logo size: `112 × 112px`
- Text container: `160.46 × 61px`
- Title: `24px, #2f2f2f, center-aligned`
- Subtitle: `14px, #6b6b6b, center-aligned`
- Gap between title/subtitle: `4px`

---

## Node IDs Reference

| Element | Node ID | Type |
|---------|---------|------|
| Splash Frame | `2:778` | frame |
| tl | `2:779` | frame |
| Container | `2:780` | frame |
| SplashScreen | `2:781` | frame |
| Logo Container | `2:782` | frame |
| Logo | `2:783` | frame |
| Text Container | `2:809` | frame |
| Title Frame | `2:810` | frame |
| Title Text | `2:811` | text |
| Subtitle Frame | `2:812` | frame |
| Subtitle Text | `2:813` | text |
| Vector Stroke 1 | `83:3698` | vector |
| Vector Stroke 2 | `83:3699` | vector |

---

## Design Tokens

```json
{
  "colors": {
    "background": "#faf9f6",
    "title": "#2f2f2f",
    "subtitle": "#6b6b6b"
  },
  "typography": {
    "title": {
      "fontFamily": "Playfair Display Medium",
      "fontSize": 24,
      "lineHeight": 36,
      "letterSpacing": 0.24,
      "color": "#2f2f2f",
      "textAlign": "center"
    },
    "subtitle": {
      "fontFamily": "Inter Regular",
      "fontSize": 14,
      "lineHeight": 21,
      "letterSpacing": 0.28,
      "color": "#6b6b6b",
      "textAlign": "center"
    }
  },
  "spacing": {
    "logoToText": 10,
    "titleToSubtitle": 4,
    "containerPadding": 0
  },
  "dimensions": {
    "frame": { "width": 393, "height": 852 },
    "logo": { "width": 112, "height": 112 },
    "textContainer": { "width": 160.46, "height": 61 }
  },
  "opacity": {
    "container": 0.988
  }
}
```

