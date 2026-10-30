# Sending email from the Render deployment

Render's free plan blocks outgoing SMTP (ports 25, 465 and 587), so the API sends email
through [Brevo](https://www.brevo.com)'s HTTPS API instead (`DG_EMAIL_BACKEND=brevo`).
Brevo's free plan allows 300 emails a day and needs no domain of your own.

## 1. Create the sender in Brevo

1. Sign up at <https://www.brevo.com> (free plan) and finish the account questions.
2. **Settings > Senders, domains & dedicated IPs > Senders > Add a sender**. Enter the shop
   name and the address emails should come from, for example `sivashreejewellers@gmail.com`.
   Brevo emails that address a confirmation link; open it to verify the sender.
3. **Settings > SMTP & API > API keys > Generate a new API key**. Copy the key (it starts
   with `xkeysib-`); Brevo shows it only once.

A Gmail or other free-mail sender works, but some messages may land in spam. A sender on
the shop's own domain (verify the domain under **Domains**) is delivered more reliably.

## 2. Set the values on Render

Dashboard > `sivashree-digigold-api` > **Environment**:

| Key | Value |
| --- | --- |
| `DG_EMAIL_BACKEND` | `brevo` |
| `DG_BREVO_API_KEY` | the `xkeysib-...` key |
| `DG_EMAIL_FROM` | the verified sender address |
| `DG_EMAIL_FROM_NAME` | the name shown in the inbox, e.g. `Sivashree Jewellers` |

Save; Render redeploys. Never commit the API key to the repository.

## 3. Check it

Sign up in the app with a real address. If nothing arrives, look in spam, then in the
service's **Logs** for `email to ... failed: Brevo 4xx ...`, which gives Brevo's reason
(an unverified sender or a wrong key are the usual ones). Brevo's **Transactional > Logs**
page shows every message it accepted.
