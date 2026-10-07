# L00 · Readiness (homework before Thursday 11:00 ET, 10 minutes)

1. Open the lab link from the LMS. GitHub builds your Codespace (VS Code in the browser). First build: about 3 minutes. Do not close the tab.
2. When the terminal says **Setup finished**, run:
   ```bash
   npm run dev
   ```
   It creates **your own Stripe sandbox** (no Stripe account needed) and starts the Zinc Store. If it prints **ONE CLICK NEEDED**, open the link, create or sign in to a free Stripe account, approve, and it continues.
   Leave this terminal running. Click **Open in Browser** when VS Code offers port 3000: that is your store.
3. Open a second terminal (the **+** in the terminal panel) and run:
   ```bash
   cydeo login
   ```
   Approve the device in your browser and wait for `Logged in.`
4. In the second terminal:
   ```bash
   npm run doctor
   npm run check:lab -- L00
   ```
   Every line must say PASS. Post a screenshot of the verdict in the class thread.

Stuck for more than 2 minutes? Post the doctor output in the support thread. Do not try to fix your machine; there is nothing to install.
