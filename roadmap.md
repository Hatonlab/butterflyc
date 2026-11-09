# Tasks
- [ ] Improve gift artwork, selection, and shared celebrations without changing prices.
- [ ] Support uploaded image and animated GIF rank badges across member and chat views.
- [x] Enlarge and polish phone UI while preserving stable chat controls.
- [x] Abbreviate header coin balances with K/M/B/T suffixes.
- [x] Manage rank badges and assignments, including the owner, without removing owner authority.
- [x] Group admin room messages by member, then room, with complete room history.
- [x] Show confirmed gift effects to all signed-in members (committed-event tests passed; publication verified).
- [ ] Verify signed-in admin/rank/gift flows and chat layout, including media/recording controls. Blocked: the requesting user's account cannot be matched for automatic sign-in; requires the user to sign in to the preview. Rechecked on November 9: public login/signup layouts fit 320/390/726/1280px without horizontal overflow or runtime errors; all 15 targeted tests passed. Code review found no remaining defect in requested ranks, grouped moderation history, or committed gift effects; authenticated end-to-end verification remains pending.