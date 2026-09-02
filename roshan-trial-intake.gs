// roshan-trial-intake.gs
// Bound to the "Roshan Gym - Free Trial Booking Form" (Extensions > Apps Script
// from inside the Form editor). Fires on every submission, forwards the raw
// answers to the app, which does all the parsing/validation.
//
// Setup:
//   1. Paste this whole file into the bound script's Code.gs.
//   2. Project Settings > Script Properties, add:
//        API_URL        = https://<your-vercel-domain>/api/trial-intake
//        SHARED_SECRET  = <same value as Vercel's TRIAL_INTAKE_SECRET>
//   3. Triggers (clock icon) > + Add Trigger:
//        Function: onTrialFormSubmit
//        Event source: From form
//        Event type: On form submit
//      Save — it'll ask you to authorize the script the first time.
//   4. Submit a test response and check Executions (the list icon) for errors.

function onTrialFormSubmit(e) {
  var props = PropertiesService.getScriptProperties();
  var API_URL = props.getProperty('API_URL');
  var SHARED_SECRET = props.getProperty('SHARED_SECRET');
  if (!API_URL || !SHARED_SECRET) {
    Logger.log('Missing API_URL or SHARED_SECRET script property.');
    return;
  }

  // Build { "exact question title": answer } — checkbox/checkbox-grid
  // questions come back as arrays already; everything else is a string.
  // Titles are used verbatim (notes and all), and the app's field matching
  // is written to tolerate that.
  var answers = {};
  var itemResponses = e.response.getItemResponses();
  for (var i = 0; i < itemResponses.length; i++) {
    var ir = itemResponses[i];
    answers[ir.getItem().getTitle()] = ir.getResponse();
  }

  var payload = {
    secret: SHARED_SECRET,
    submitted_at: e.response.getTimestamp().toISOString(),
    respondent_email: e.response.getRespondentEmail() || '',
    answers: answers,
  };

  var options = {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  };

  var res = UrlFetchApp.fetch(API_URL, options);
  var code = res.getResponseCode();
  if (code < 200 || code >= 300) {
    Logger.log('Intake POST failed (' + code + '): ' + res.getContentText());
  }
}
