# Design system rules

These rules apply to the whole client. Consistency and maintainability are requirements.

## Units

Everything in the app is defined in rem, except borders and shadows.

## Tokens

- No hardcoded colours anywhere in the app. Every colour comes from a colour token.
- Every spacing, size, font size, font weight, radius, shadow, duration and z-index comes from a token.
- The token set is small and shared. A couple of spacings are defined and used everywhere. Never add a one-off token for a single place or a single value.
- Tokens are defined only in `ChatUiT.Client/src/styles/`.

## Components

- `ChatUiT.Client/src/components/common` holds only generic UI components. Components that belong to a feature (assistants, chat, settings and so on) live in that feature's folder, with their own CSS.
- Feature CSS follows the same token rules as the library, and does not restyle library classes.

## Behaviour

- The same kind of control behaves the same way everywhere.
- Popovers in a toolbar open on hover. A click keeps a popover open, and while one is open from a click, hovering the others does not open them. Only one is open at a time.
