<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Media-only chat messages use an empty content string and a valid media path/type; both message tables enforce this invariant so uploads do not require captions.
- Keep the shared chat composer and audio controls dimensionally stable, and constrain scrolling to the message list to prevent phone viewport shifts.
- Store cosmetic rank definitions and member assignments separately from authority roles; RLS protects owner assignments so visual promotion never removes owner authority.
- Rank image badges store original files in private chat-media storage and resolve signed URLs through the shared media hook; never rasterize GIFs so animation is preserved.
- Gift selection and committed celebrations share GiftArtwork so each gift has consistent artwork without altering its economy rules.
- Drive shared gift celebrations from committed gift INSERT events, never client-sent announcements, so only paid successful gifts appear to members.
- Admin room-message grouping loads paginated history without a fixed row cap, then groups by member and room so moderation includes the full visible history.
