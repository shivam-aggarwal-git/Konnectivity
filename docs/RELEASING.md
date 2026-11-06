# Publishing and licensing

## License boundary

The inherited LICENSE is **PolyForm Noncommercial 1.0.0**, with the original required copyright notice. The upstream permits specified noncommercial uses; it is not an OSI open-source license. The [Open Source Definition](https://opensource.org/osd) requires unrestricted fields of endeavor and redistribution. Do not substitute MIT/Apache, delete upstream notices, or advertise this derivative as OSI open source without authorization from the relevant rights holders.

To make the entire project available under an OSI-approved license, obtain the necessary relicensing permission from the upstream copyright holders, or replace restricted components with independently created, compatibly licensed code. This release prepares a clean source-available distribution; it does not grant rights the upstream license withholds. See LICENSE and NOTICE for exact terms and provenance.

## Before publishing

1. Keep this source checkout separate from a personal/live instance. Do not copy runtime files or old Git history into it.
2. Review LICENSE and NOTICE, set the real repository URL if desired, and enable a private vulnerability reporting channel.
3. Run the validation commands below. Inspect screenshots and staged changes for personal content.
4. Publish the clean repository only after the licensing description is correct. No repository is created or uploaded by this source snapshot.

```sh
npm ci
npm run typecheck
npm test
npm run test:integration
npm run build
npm run check:release
```

The scanner intentionally rejects a checkout containing `data/` or `cache/`. Use external directories for preview runtime data, or remove only disposable demo runtime before release. Never remove personal data just to make a check pass.

## New repository commands

Run these in the clean Konnectivity source directory after reviewing it. Replace the destination with a repository you own; it is deliberately not preconfigured.

```sh
git init -b main
git add .
git diff --cached --stat
git diff --cached --check
git diff --cached
# Inspect staged screenshots as well.
git commit -m "Prepare Konnectivity source distribution"
# git remote add origin https://github.com/YOUR-ACCOUNT/konnectivity.git
# git push -u origin main
```

Do not commit `.env`, credential exports, local music, chat media, runtime indexes, admin hashes, tunnel URLs or old private history. `.gitignore` helps with future additions; it cannot remove data from history. If a real credential was previously published, revoke it and clean history through the hosting provider’s documented process.

## Release archive

From a reviewed commit:

```sh
git archive --format=tar.gz --prefix=Konnectivity/ --output=../Konnectivity-source.tar.gz HEAD
```

The supplied screenshots show an isolated room with synthetic demonstration audio and fictional participants. Retake them from demo data when the UI changes; never capture your personal server for public docs.
