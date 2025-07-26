# Design System Usage Guide

## Button Variants

### When to Use Each Button Type

**Primary (`variant="primary"`)**
- Main call-to-action buttons
- Form submit buttons
- "Continue", "Save", "Submit" actions
- Most important action on a page

**Secondary (`variant="secondary"`)**
- Secondary actions
- "Cancel", "Back", "Skip" buttons
- Alternative options
- Less important than primary but still significant

**Ghost (`variant="ghost"`)**
- Tertiary actions
- Settings, preferences
- Less prominent actions
- Subtle interactions

**Text (`variant="text"`)**
- Inline actions
- Link-style buttons
- "Edit", "Delete", "View details"
- Navigation within content

**Status Buttons**
- `success`: Completion, approval actions
- `danger`: Destructive actions (delete, remove)
- `warning`: Caution actions
- `info`: Informational actions

## Link Styles

### Text Links
For inline text links that need underline animation:
```tsx
<a href="/path" className="text-link">Click here</a>
```

### Button Links
For links that look like buttons:
```tsx
<Link to="/path">
  <Button variant="primary">Go somewhere</Button>
</Link>
```

### Navigation Links
Use the nav-link class for navigation:
```tsx
<a href="/path" className="nav-link">Navigation Item</a>
```

## Mobile Considerations

- All buttons are full-width on mobile by default
- Minimum 40px height for touch targets
- Special considerations for 360px screens
- Navigation optimized for thumb interaction

## Do's and Don'ts

### Do:
- Use primary buttons sparingly (1-2 per screen)
- Maintain consistent hierarchy
- Test on 360px screens
- Use semantic variants for status actions

### Don't:
- Mix button styles arbitrarily
- Add custom styles that override the system
- Use multiple primary buttons in the same view
- Forget to test mobile interactions

## Responsive Behavior

The design system automatically handles:
- Full-width buttons on mobile
- Appropriate sizing at 360px breakpoint
- Touch-friendly targets
- Proper spacing and padding

Visit `/design-system` to see all components in action.