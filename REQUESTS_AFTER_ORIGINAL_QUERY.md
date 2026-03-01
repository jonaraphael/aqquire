# Requests After Original Query

Original query (excluded from this list): "Convex isn't working for me. Rebuild this repo to not use it."

Below is a complete chronological list of requests/issues raised after that original query.

## Chronological Log

1. Make the app deployable via GitHub Actions to GitHub Pages for demo purposes.
2. Reported blocked push due to GitHub secret scanning violations in commit history (`.env` secrets detected).
3. Make the app actually use OpenAI API key to identify primary image target and look it up online.
4. Remove big capture button on AQQUIRE screen and show live camera feed there.
5. After snap, do not ask confirmation; switch directly to Vault with new item pending.
6. Use `gpt-5.2`.
7. Make trophies more visual (possibly icon per trophy).
8. Swipe/long-press interactions are jerky: remove long press, smooth swipe coloration.
9. Do not remove object after swipe; leave it in place, gold and sparkly.
10. At end of each agentic run, push to `main`.
11. Allow tapping AQQUIRE circle to capture (not tapping screen).
12. Remove "camera ready" words.
13. App is not sending to GPT; fix it.
14. Move canceled items to bottom section of Vault.
15. Do not allow duplicates in Vault.
16. Swipe gold fill should track swipe distance in real time and recede when finger moves back.
17. Do not move acquired items in feed.
18. Make QR code a real QR code.
19. Make QR reader show camera; it was not working.
20. Reported error on capture: `VITE_OPENAI_API_KEY IS REQUIRED FOR AQQUIRE CAPTURE LOOKUP`.
21. Swipe color bug: color came only from left regardless of swipe direction.
22. Reframe spender percentile to "Top X% of spenders" phrasing.
23. Restore QR to gold/stylized look.
24. Add icon to each side tab button; improve current icon quality (web search allowed if needed).
25. Reported key error: "OPENAI KEY MISSING. SET VITE_OPENAI_API_KEY (OR OPENAI_API_KEY)..."
26. Asked whether OpenAI key was set as GitHub secret for this repo.
27. Reported key error still persists.
28. Remove "Luxury Runtime" pill.
29. Remove "AQQUIRE" button/badge on feed rows.
30. Make swipe behavior Tinder-like:
    - One direction adds to Vault.
    - Opposite direction removes from feed.
31. If user removes more than 3 items from one category, ask to hide that category.
32. If user declines hide, ask again when they remove 30 from that category.
33. Remove text "Live camera. Tap AQQUIRE circle to capture."
34. Add very sparse gold sparkle overlay on camera view.
35. After capture, swap live camera view to captured image for confirmation.
36. After GPT identifies object, use a high-quality marketing image (ideally manufacturer source material).
37. Remove "Luxury Runtime" pill (reiterated).
38. Object identification quality too low; increase model thinking.
39. Rename capture overlay text from "Processing" to "Procuring."
40. Price is wrong; ensure purchasable source link and correct price capture.
41. In Vault, clicking "pending" should open a new browser tab to source URL for debugging.
42. Reported OpenAI 400 error: `temperature` unsupported for chosen model.
43. Remove word "AQQUIRE" inside camera window.
44. Allow clearing canceled items in Vault.
45. Capture flow UX change:
    - Do not wait on AQQUIRE tab for processing.
    - Show ~1s "Capturing" pause.
    - Transition to Vault immediately showing captured photo.
    - Show "Procuring Price" until model returns.
    - Then update price/details and marketing image in Vault.
46. Swiping image in Vault should toggle between captured image and AI marketing image.
47. Improve feed/vault tab icons; suggested pearl necklace and bank vault door.
48. Reported bug: item showed `Failed` and `$0` for a Jaguar car; asked to fix.
49. Make pearl necklace icon more like a diamond necklace shape.
50. When procurement finishes, show toast:
    - Click to jump to Vault.
    - Swipe up to hide.
51. Long identification feels frozen; add indication app is still reasoning.
52. Make icons bigger and centered over text.
53. Allow canceling item while price determination is still pending.
54. Toast behavior adjustments:
    - Toast appears only when price finding is finished.
    - Swipe down to ignore/dismiss.
55. Spinner should be next to "Procuring Price."
56. Remove phrase "Reasoning Through Image."

## Workflow / Meta Preferences Included Above

- "Use `gpt-5.2`."
- "At end of each agentic run, push to `main`."
