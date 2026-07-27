# MVP Test Checklist

## Demo mode

- [ ] Feed loads with three sample photos
- [ ] Newest/Top sorting changes the order
- [ ] A photo can be liked once
- [ ] Map opens and shows three photo markers
- [ ] `#/dog/DEMO42` activates Hot Dog #42
- [ ] Manual location search returns Charlotte results
- [ ] A selected location displays a draggable pin
- [ ] A photo can be selected and previewed
- [ ] Consent is required before publication
- [ ] Demo upload appears at the top of the feed

## Shared Supabase mode

- [ ] Yellow demo notice disappears after `config.js` is filled in
- [ ] Upload from Phone A appears on Phone B
- [ ] GPS permission works on the HTTPS Cloudflare URL
- [ ] Declining GPS still allows manual location search
- [ ] Uploaded image is present in Supabase Storage
- [ ] Photo row contains the correct hot dog ID
- [ ] Like from Phone B increments the visible count
- [ ] A second like from the same browser is blocked
- [ ] Photo marker appears on the map

## Safety boundary for this build

- [ ] Test link is shared only with trusted testers
- [ ] Testers understand uploads publish immediately
- [ ] Test content is deleted before adding moderation and launching publicly
