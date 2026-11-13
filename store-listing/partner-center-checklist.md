# Putting Edita on the Microsoft Store — step by step

Everything to paste is in `listing.md` in this folder. Images are in `screenshots` and `logos`.

## A. One-time account set-up
1. Open https://partner.microsoft.com/dashboard and sign in with the Microsoft account you want to own Edita.
2. If you do not have a developer account yet: **Apps and games › Get started**, choose
   **Company** (Vidyasagar Robotics Academy) or **Individual**, fill in the details and finish the sign-up.
   Company accounts are checked by Microsoft and this can take a few days.

## B. Reserve the name
3. **Apps and games › New product › MSIX or PWA app**.
4. Type **Edita** and click **Check availability**, then **Reserve product name**.
   If "Edita" is taken, try "Edita Code Editor".

## C. Send us the three identity values (needed to build the Store package)
5. In the new product, open **Product management › Product identity**.
6. Copy these three lines exactly and send them to us:
   - **Package/Identity/Name** (looks like `12345VidyasagarRobotics.Edita`)
   - **Package/Identity/Publisher** (looks like `CN=1A2B3C4D-....`)
   - **Package/Properties/PublisherDisplayName** (for example `Vidyasagar Robotics Academy`)
7. We put them in `installer/msix-identity.json`, build `Edita_1.3.0_x64.msix` and give you the file.

## D. Fill in the submission (Start your submission)
8. **Pricing and availability**: Free, all markets, public. Save.
9. **Properties**: Category **Developer tools**; privacy policy URL, website and support e-mail from
   `listing.md`; answer "collects personal information" with **No**. Save.
10. **Age ratings**: start the questionnaire and answer as in `listing.md` (all **No**). Save.
11. **Packages**: drag in `Edita_1.3.0_x64.msix`. Wait until it shows as validated. Save.
12. **Store listings › English (United States)**: paste the description, short description,
    what's new, features and search terms; upload the screenshots (in order) and the logos. Save.
13. **Submission options**: leave as is (publish as soon as certified). In **Notes for certification**
    write: "Edita is an offline text/code editor. No account or test data is needed."
14. Click **Submit to the Store**.

## E. After you submit
15. Microsoft certifies the app, usually within 1–3 working days. You get an e-mail.
16. If it is rejected, forward us the report and we will fix it.
17. For future versions: we build a new MSIX with a higher version number, and you upload it
    in a new submission (step 11 only, plus "What's new").
