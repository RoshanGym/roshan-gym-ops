// roshan-trial-send.gs
// Standalone Apps Script, deployed as a Web App under fitnessroshan@gmail.com
// (that's the Gmail address the emails below are sent from). Receives a POST
// from the app's /api/trial-bookings/:id/action handler and sends the right
// email via Gmail — the app never talks to Gmail directly.
//
// Setup:
//   1. script.google.com > New project. Paste this whole file in as Code.gs.
//   2. Project Settings > Script Properties, add:
//        SEND_SECRET = <same value as Vercel's APPS_SCRIPT_SEND_SECRET>
//   3. Deploy > New deployment > type "Web app":
//        Execute as:      Me (fitnessroshan@gmail.com)
//        Who has access:  Anyone
//      (it must be "Anyone" — the caller is a server, not a signed-in
//      Google user, so "Anyone with a Google account" would reject it.)
//   4. Copy the Web app URL into Vercel's APPS_SCRIPT_SEND_URL.
//   5. Every time you edit this file, ship a new version: Deploy > Manage
//      deployments > pencil icon > New version > Deploy. Editing the code
//      alone does NOT update a live Web app deployment.

function doPost(e) {
  var result;
  try {
    var body = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var SEND_SECRET = props.getProperty('SEND_SECRET');
    if (!body || body.secret !== SEND_SECRET) {
      return jsonOut_({ ok: false, error: 'unauthorized' });
    }

    var booking = body.booking || {};
    if (!booking.email) {
      return jsonOut_({ ok: false, error: 'booking.email is required' });
    }

    if (body.action === 'confirmation') {
      sendConfirmationEmail_(booking);
    } else if (body.action === 'reschedule') {
      sendRescheduleEmail_(booking, body.reason || '');
    } else if (body.action === 'daypass') {
      sendDaypassEmail_(booking, body.closing || '', body.qrBase64, body.qrContentType);
    } else {
      return jsonOut_({ ok: false, error: 'unknown action: ' + body.action });
    }
    result = { ok: true };
  } catch (err) {
    result = { ok: false, error: String((err && err.message) || err) };
  }
  return jsonOut_(result);
}

function jsonOut_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function fmtDate_(isoOrDate) {
  if (!isoOrDate) return '';
  try {
    var d = new Date(isoOrDate);
    if (isNaN(d.getTime())) return String(isoOrDate);
    return Utilities.formatDate(d, 'Asia/Manila', 'MMMM d, yyyy');
  } catch (err) {
    return String(isoOrDate);
  }
}

function escapeHtml_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripHtml_(html) {
  return String(html).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

function bookingDetailsHtml_(b) {
  return ''
    + '<ul>'
    + '<li><b>Branch:</b> ' + escapeHtml_(b.branch || '') + '</li>'
    + '<li><b>Service:</b> ' + escapeHtml_(b.service || '') + '</li>'
    + '<li><b>Date:</b> ' + fmtDate_(b.date) + '</li>'
    + '<li><b>Time:</b> ' + escapeHtml_(b.time || '') + '</li>'
    + '</ul>';
}

function sendConfirmationEmail_(b) {
  var subject = 'Your Free Trial at Roshan Gym is Confirmed!';
  var html = ''
    + '<p>Hi ' + escapeHtml_(b.fullName) + ',</p>'
    + '<p>Great news — your free trial has been <b>confirmed</b>! Here are the details:</p>'
    + bookingDetailsHtml_(b)
    + '<p>Please arrive 10–15 minutes early. We can\'t wait to see you!</p>'
    + '<p>— Roshan Gym</p>';
  GmailApp.sendEmail(b.email, subject, stripHtml_(html), { htmlBody: html, name: 'Roshan Gym' });
}

function sendRescheduleEmail_(b, reason) {
  var subject = 'Your Free Trial at Roshan Gym Has Been Rescheduled';
  var html = ''
    + '<p>Hi ' + escapeHtml_(b.fullName) + ',</p>'
    + '<p>Your free trial has been rescheduled. Here are the updated details:</p>'
    + bookingDetailsHtml_(b)
    + (reason ? '<p><b>Reason:</b> ' + escapeHtml_(reason) + '</p>' : '')
    + '<p>Sorry for the inconvenience — see you soon!</p>'
    + '<p>— Roshan Gym</p>';
  GmailApp.sendEmail(b.email, subject, stripHtml_(html), { htmlBody: html, name: 'Roshan Gym' });
}

function sendDaypassEmail_(b, closing, qrBase64, qrContentType) {
  if (!qrBase64) throw new Error('No QR code was provided with this request.');
  var subject = 'Your Roshan Gym Day Pass';
  var html = ''
    + '<p>Hi ' + escapeHtml_(b.fullName) + ',</p>'
    + '<p>' + (closing ? escapeHtml_(closing) : 'Here is your day pass — show it at the front desk when you arrive.') + '</p>'
    + '<p>— Roshan Gym</p>';
  var blob = Utilities.newBlob(Utilities.base64Decode(qrBase64), qrContentType || 'image/png', 'day-pass-qr.png');
  GmailApp.sendEmail(b.email, subject, stripHtml_(html), { htmlBody: html, name: 'Roshan Gym', attachments: [blob] });
}
