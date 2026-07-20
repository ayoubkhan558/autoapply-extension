// =====================================================================
// AutoApply — SHARED FIELD REGISTRY (single source of truth)
// =====================================================================
//
// This file is the ONE place that defines every autofill field. It is loaded
// in three places (and must load BEFORE matcher.js / storage.js / options.js):
//   1. The content script  (manifest.json -> content_scripts.js)
//   2. On-demand injection  (popup.js -> chrome.scripting.executeScript)
//   3. The popup & options pages (popup.html / options.html <script> tags)
//
// ---------------------------------------------------------------------
// HOW TO ADD A NEW FIELD  (this is the whole job — one entry, one place):
// ---------------------------------------------------------------------
//   Add an object to AA_FIELD_DEFS below, e.g.
//
//     { group: "personal", name: "maidenName", label: "Maiden name",
//       words: ["maiden name", "birth surname"], attrs: ["maidenname"] }
//
//   That single entry automatically:
//     - shows the input in the Options profile form (correct section),
//     - is saved into the profile JSON under personal.maidenName,
//     - is flattened by the content script (buildFlat is generic), and
//     - is matched on web forms using the `words` / `attrs` synonyms.
//   No other file needs editing.
//
//   To add a whole new repeating section (like "projects"), add it to
//   AA_REPEATER_GROUPS below and add its fields to AA_FIELD_DEFS with that
//   group name.
//
// Entry fields:
//   group : "personal" | "links" | "professional"      -> flat form sections
//           "experience" | "education" | "projects" |
//           "certifications" | "awards" | "volunteering" -> repeating list items
//   name  : the JSON key inside that group (camelCase)
//   label : human label shown in the Options form
//   long  : true  -> render a multi-line <textarea> instead of <input>
//   list  : true  -> value is an array; edited as comma-separated text
//   form  : false -> used for matching only, NOT shown in the editable form
//   words : label/visible-text synonyms seen on real web forms (lowercase)
//   attrs : name/id/attribute synonyms (lowercase, no spaces/dashes/underscores)
//           (omit words/attrs entirely to store a field without auto-matching it)
// =====================================================================

var AA_FIELD_DEFS = [
  // ---- Personal -----------------------------------------------------
  { group: "personal", name: "firstName", label: "First name", words: ["first name", "given name", "forename", "legal first name", "your first name"], attrs: ["firstname", "first_name", "first-name", "givenname", "given-name", "fname"] },
  { group: "personal", name: "lastName", label: "Last name", words: ["last name", "surname", "family name", "legal last name", "your last name"], attrs: ["lastname", "last_name", "last-name", "surname", "familyname", "family-name", "lname"] },
  { group: "personal", name: "middleName", label: "Middle name", words: ["middle name", "middle initial"], attrs: ["middlename", "middle_name", "middle-name", "middleinitial"] },
  { group: "personal", name: "preferredName", label: "Preferred name", words: ["preferred name", "nickname", "goes by"], attrs: ["preferredname", "nickname", "preferred_name"] },
  { group: "personal", name: "username", label: "Username", words: ["username", "user name", "login", "account username"], attrs: ["username", "user_name", "user-name", "login", "userid", "user_id"] },
  { group: "personal", name: "email", label: "Email", words: ["email", "e-mail", "email address", "contact email", "your email"], attrs: ["email", "emailaddress", "email_address", "e-mail", "contactemail", "useremail"] },
  { group: "personal", name: "alternateEmail", label: "Alternate email", words: ["alternate email", "secondary email", "other email", "alternative email"], attrs: ["alternateemail", "secondaryemail", "altemail"] },
  { group: "personal", name: "phone", label: "Phone", words: ["phone", "mobile", "telephone", "contact number", "cell", "phone number", "mobile number", "contact no"], attrs: ["phone", "tel", "telephone", "mobile", "phonenumber", "phone_number", "mobilenumber", "contactnumber", "cellphone"] },
  { group: "personal", name: "whatsapp", label: "WhatsApp", words: ["whatsapp", "whatsapp number"], attrs: ["whatsapp", "whatsappnumber"] },
  { group: "personal", name: "dateOfBirth", label: "Date of birth", words: ["date of birth", "birth date", "birthday", "dob"], attrs: ["dob", "dateofbirth", "birthdate", "birthday", "date_of_birth"] },
  { group: "personal", name: "gender", label: "Gender", words: ["gender", "sex"], attrs: ["gender", "sex"] },
  { group: "personal", name: "nationality", label: "Nationality", words: ["nationality", "citizenship"], attrs: ["nationality", "citizenship"] },
  { group: "personal", name: "pronouns", label: "Pronouns", words: ["pronouns"], attrs: ["pronouns"] },
  { group: "personal", name: "maritalStatus", label: "Marital status", words: ["marital status", "marriage status"], attrs: ["maritalstatus"] },
  { group: "personal", name: "cnic", label: "CNIC / National ID", words: ["cnic", "national id", "national identity", "id card number", "nic"], attrs: ["cnic", "nationalid", "nic"] },
  { group: "personal", name: "veteranStatus", label: "Veteran status", words: ["veteran status", "are you a veteran", "military veteran", "protected veteran"], attrs: ["veteranstatus", "veteran"] },
  { group: "personal", name: "disabilityStatus", label: "Disability status", words: ["disability status", "do you have a disability", "disability"], attrs: ["disabilitystatus", "disability"] },
  { group: "personal", name: "ethnicity", label: "Ethnicity", words: ["ethnicity", "ethnic background", "race"], attrs: ["ethnicity", "race", "ethnicbackground"] },
  { group: "personal", name: "emergencyContactName", label: "Emergency contact name", words: ["emergency contact name", "emergency contact"], attrs: ["emergencycontactname", "emergencycontact"] },
  { group: "personal", name: "emergencyContactPhone", label: "Emergency contact phone", words: ["emergency contact phone", "emergency contact number", "emergency phone"], attrs: ["emergencycontactphone", "emergencyphone", "emergencycontactnumber"] },
  // Derived for matching only (built from firstName + lastName by the content script).
  { group: "personal", name: "fullName", label: "Full name", form: false, words: ["full name", "your name", "legal name", "name"], attrs: ["fullname", "full_name", "full-name", "yourname", "name"] },

  // ---- Address ------------------------------------------------------
  { group: "address", name: "address1", label: "Address line 1", words: ["address line 1", "street address", "address", "street"], attrs: ["address1", "addressline1", "street-address", "street", "address"] },
  { group: "address", name: "address2", label: "Address line 2", words: ["address line 2", "apartment", "suite", "unit"], attrs: ["address2", "addressline2", "apt", "suite"] },
  { group: "address", name: "currentAddress", label: "Current address", words: ["current address", "present address", "residential address"], attrs: ["currentaddress", "presentaddress", "residentialaddress"] },
  { group: "address", name: "permanentAddress", label: "Permanent address", words: ["permanent address", "home address"], attrs: ["permanentaddress", "homeaddress"] },
  { group: "address", name: "city", label: "City", words: ["city", "town"], attrs: ["city", "town", "locality"] },
  { group: "address", name: "state", label: "State / Province", words: ["state", "province", "region", "state / province", "state province", "county"], attrs: ["state", "province", "region", "administrativearea", "stateprovince", "addresslevel1"] },
  { group: "address", name: "zip", label: "ZIP / Postal code", words: ["zip code", "postal code", "zip postal code", "postcode", "zip"], attrs: ["zip", "zipcode", "postalcode", "postcode", "postal_code", "postal", "zippostalcode"] },
  { group: "address", name: "country", label: "Country", words: ["country", "country of residence", "country region"], attrs: ["country", "countryname", "countryregion"] },

  // ---- Links --------------------------------------------------------
  { group: "links", name: "linkedin", label: "LinkedIn", words: ["linkedin"], attrs: ["linkedin"] },
  { group: "links", name: "github", label: "GitHub", words: ["github"], attrs: ["github"] },
  { group: "links", name: "portfolio", label: "Portfolio / personal website", words: ["portfolio", "personal website", "website", "portfolio website", "portfolio url", "website url"], attrs: ["portfolio", "website", "url", "homepage", "personalwebsite"] },
  { group: "links", name: "website", label: "Personal website", words: ["personal website", "website", "url", "portfolio", "portfolio website"], attrs: ["website", "url", "homepage", "portfolio", "personalwebsite"] },
  { group: "links", name: "facebook", label: "Facebook", words: ["facebook", "facebook profile", "facebook url"], attrs: ["facebook", "facebookurl", "fburl"] },
  { group: "links", name: "twitter", label: "Twitter / X", words: ["twitter", "x profile"], attrs: ["twitter"] },
  { group: "links", name: "stackoverflow", label: "Stack Overflow", words: ["stack overflow", "stackoverflow"], attrs: ["stackoverflow"] },
  { group: "links", name: "dribbble", label: "Dribbble", words: ["dribbble"], attrs: ["dribbble"] },
  { group: "links", name: "behance", label: "Behance", words: ["behance"], attrs: ["behance"] },
  { group: "links", name: "medium", label: "Medium", words: ["medium profile", "medium blog"], attrs: ["medium"] },

  // ---- Professional -------------------------------------------------
  { group: "professional", name: "currentTitle", label: "Current title", words: ["current title", "current position", "present title", "current role", "present role", "designation", "current job title"], attrs: ["currenttitle", "current_title", "designation", "currentrole"] },
  { group: "professional", name: "currentCompany", label: "Current company", words: ["current company", "current employer", "present company"], attrs: ["currentcompany", "current_company", "currentemployer"] },
  { group: "professional", name: "summary", label: "Professional summary", long: true, words: ["professional summary", "summary", "profile summary", "about me", "about you", "bio", "about"], attrs: ["summary", "profilesummary", "bio", "aboutme", "about"] },
  { group: "professional", name: "careerObjective", label: "Career objective", long: true, words: ["career objective", "objective", "career goal"], attrs: ["objective", "careerobjective", "careergoal"] },
  { group: "professional", name: "portfolioSummary", label: "Portfolio summary", long: true, words: ["portfolio summary", "portfolio description"], attrs: ["portfoliosummary"] },
  { group: "professional", name: "experienceYears", label: "Years of experience", words: ["years of experience", "total experience", "experience", "years experience", "how many years", "yrs of experience"], attrs: ["experience", "yearsexperience", "years_of_experience", "yoe", "yrsexperience"] },
  { group: "professional", name: "totalExperienceMonths", label: "Total experience (months)", words: ["total experience in months", "experience in months", "months of experience"], attrs: ["experiencemonths", "totalexperiencemonths", "monthsexperience"] },
  { group: "professional", name: "frontendExperienceYears", label: "Frontend experience (years)", words: ["frontend experience", "front end experience", "years of frontend experience"], attrs: ["frontendexperience", "frontendyears"] },
  { group: "professional", name: "reactExperienceYears", label: "React experience (years)", words: ["react experience", "years of react experience", "react js experience"], attrs: ["reactexperience", "reactyears"] },
  { group: "professional", name: "wordpressExperienceYears", label: "WordPress experience (years)", words: ["wordpress experience", "years of wordpress"], attrs: ["wordpressexperience", "wordpressyears"] },
  { group: "professional", name: "shopifyExperienceYears", label: "Shopify experience (years)", words: ["shopify experience", "years of shopify"], attrs: ["shopifyexperience", "shopifyyears"] },
  { group: "professional", name: "skills", label: "Skills", long: true, words: ["key skills", "technical skills", "skills", "areas of expertise", "core competencies", "tech stack", "technologies", "skill set"], attrs: ["skills", "skillset", "keyskills", "techskills", "expertise", "competencies", "techstack"] },
  { group: "professional", name: "preferredTeams", label: "Preferred team / department", words: ["preferred team", "preferred department", "team department", "preferred team department", "which team"], attrs: ["preferredteam", "preferredteams", "teamdepartment", "preferreddepartment"] },
  { group: "professional", name: "languages", label: "Languages", list: true, words: ["languages", "languages known", "spoken languages", "language proficiency"], attrs: ["languages", "languagesknown"] },
  { group: "professional", name: "tools", label: "Tools", list: true, words: ["tools", "tools and technologies", "software tools", "tools used"], attrs: ["tools"] },
  { group: "professional", name: "resumeUrl", label: "Resume URL", words: ["resume url", "resume link", "link to resume"], attrs: ["resumeurl", "resumelink"] },
  { group: "professional", name: "cvUrl", label: "CV URL", words: ["cv url", "cv link", "link to cv"], attrs: ["cvurl", "cvlink"] },
  { group: "professional", name: "upworkUrl", label: "Upwork URL", words: ["upwork", "upwork profile", "upwork url"], attrs: ["upwork", "upworkurl"] },
  { group: "professional", name: "employmentStatus", label: "Employment / working status", words: ["employment status", "current employment status", "current working status", "working status", "current work status", "current status"], attrs: ["employmentstatus", "workingstatus", "currentworkingstatus", "currentstatus"] },
  { group: "professional", name: "desiredJobType", label: "Desired job type", words: ["desired job type", "job type preference", "preferred job type"], attrs: ["desiredjobtype", "jobtypepreference"] },
  { group: "professional", name: "preferredWorkMode", label: "Preferred work mode", words: ["preferred work mode", "work mode", "work setup"], attrs: ["workmode", "preferredworkmode"] },
  { group: "professional", name: "preferredLocations", label: "Preferred / job location", words: ["preferred locations", "preferred location", "desired location", "location preference", "location", "job location", "current location"], attrs: ["preferredlocation", "preferredlocations", "desiredlocation", "location", "joblocation", "currentlocation"] },
  { group: "professional", name: "remotePreference", label: "Remote preference", words: ["remote preference", "work preference", "work arrangement"], attrs: ["remotepreference", "workpreference"] },
  { group: "professional", name: "availableStartDate", label: "Availability date", words: ["available start date", "earliest start date", "available from", "date available", "available date", "availability date", "availability", "when can you start", "earliest availability", "available to start", "joining date"], attrs: ["availablestartdate", "earlieststartdate", "availablefrom", "dateavailable", "availabledate", "whencanyoustart", "availabilitydate", "availability", "joiningdate"] },
  { group: "professional", name: "expectedJoiningDate", label: "Expected joining date", words: ["expected joining date", "joining date", "date of joining"], attrs: ["joiningdate", "expectedjoiningdate"] },
  { group: "professional", name: "noticePeriod", label: "Notice period", words: ["notice period", "notice", "how much notice", "current notice period", "how soon can you join", "notice period days"], attrs: ["notice", "noticeperiod"] },
  { group: "professional", name: "currentSalary", label: "Current salary", words: ["current salary", "current compensation"], attrs: ["currentsalary", "current_salary"] },
  { group: "professional", name: "lastDrawnSalary", label: "Last drawn salary", words: ["last drawn salary", "last salary", "previous salary"], attrs: ["lastdrawnsalary", "lastsalary", "previoussalary"] },
  { group: "professional", name: "desiredSalary", label: "Desired salary", words: ["desired salary", "expected salary", "salary expectation", "salary expectations", "desired pay", "expected pay", "desired compensation", "expected compensation", "compensation", "pay expectation", "expected ctc", "salary"], attrs: ["salary", "desiredsalary", "expectedsalary", "desiredpay", "expectedpay", "compensation", "expectedctc"] },
  { group: "professional", name: "minimumExpectedSalary", label: "Minimum expected salary", words: ["minimum expected salary", "minimum salary", "min salary"], attrs: ["minimumsalary", "minsalary", "minimumexpectedsalary"] },
  { group: "professional", name: "preferredSalaryRange", label: "Preferred salary range", words: ["salary range", "preferred salary range", "expected salary range"], attrs: ["salaryrange", "preferredsalaryrange"] },
  { group: "professional", name: "salaryCurrency", label: "Salary currency", words: ["salary currency", "currency", "preferred currency", "expected salary currency"], attrs: ["salarycurrency", "currency", "currencycode"] },
  { group: "professional", name: "salaryNegotiable", label: "Salary negotiable", words: ["salary negotiable", "is salary negotiable", "negotiable"], attrs: ["salarynegotiable", "negotiable"] },
  { group: "professional", name: "willingToRelocate", label: "Willing to relocate", words: ["willing to relocate", "open to relocation", "relocate", "relocation"], attrs: ["relocate", "relocation"] },
  { group: "professional", name: "openToContract", label: "Open to contract", words: ["open to contract", "contract work", "contract roles"], attrs: ["opentocontract", "contract"] },
  { group: "professional", name: "openToFreelance", label: "Open to freelance", words: ["open to freelance", "freelance work", "freelancing"], attrs: ["opentofreelance", "freelance"] },
  { group: "professional", name: "managementExperience", label: "Management experience", words: ["management experience", "leadership experience", "team management"], attrs: ["managementexperience", "leadershipexperience"] },
  { group: "professional", name: "achievements", label: "Achievements", long: true, words: ["achievements", "key achievements", "accomplishments"], attrs: ["achievements", "accomplishments"] },
  { group: "professional", name: "reasonForLeaving", label: "Reason for leaving", long: true, words: ["reason for leaving", "why are you leaving", "reason for job change"], attrs: ["reasonforleaving"] },
  { group: "professional", name: "whyJoinCompany", label: "Why join the company", long: true, words: ["why do you want to join", "why this company", "why join us", "why do you want to work here", "motivation"], attrs: ["whyjoin", "whycompany", "motivation"] },
  { group: "professional", name: "references", label: "References", long: true, words: ["references", "reference"], attrs: ["references", "reference"] },
  { group: "professional", name: "availabilityForInterview", label: "Availability for interview", words: ["availability for interview", "interview availability", "when are you available for interview"], attrs: ["interviewavailability", "availabilityforinterview"] },
  { group: "professional", name: "timezone", label: "Time zone", words: ["time zone", "timezone", "preferred timezone"], attrs: ["timezone"] },
  { group: "professional", name: "workAuthorization", label: "Work authorization", words: ["work authorization", "authorized to work", "work permit"], attrs: ["workauthorization", "authorization", "workpermit"] },
  { group: "professional", name: "needsSponsorship", label: "Needs sponsorship", words: ["require sponsorship", "need sponsorship", "visa sponsorship", "sponsorship"], attrs: ["sponsorship", "requiresponsorship"] },
  { group: "professional", name: "securityClearance", label: "Security clearance", words: ["security clearance", "clearance"], attrs: ["securityclearance", "clearance"] },
  { group: "professional", name: "linkedinHeadline", label: "LinkedIn headline", long: true, words: ["headline", "linkedin headline"], attrs: ["headline", "linkedinheadline"] },
  { group: "professional", name: "coverLetter", label: "Cover letter", long: true, words: ["cover letter", "message to hiring", "additional information", "comments", "cover note", "note to hiring manager", "anything else"], attrs: ["coverletter", "cover_letter", "message", "comments", "additionalinfo", "covernote"] },

  // ---- Experience (repeating; only the first entry is auto-filled) ----
  { group: "experience", name: "company", label: "Company", words: ["company name", "employer name", "company", "employer", "organization"], attrs: ["company", "employer", "organization", "organisation"] },
  { group: "experience", name: "title", label: "Job title", words: ["job title", "position title", "title", "position", "role"], attrs: ["jobtitle", "title", "position", "role"] },
  { group: "experience", name: "employmentType", label: "Employment type", words: ["employment type", "job type"], attrs: ["employmenttype", "jobtype"] },
  { group: "experience", name: "location", label: "Location", words: ["company location", "work location", "job location"], attrs: ["worklocation", "joblocation", "companylocation"] },
  { group: "experience", name: "startDate", label: "Start date", words: ["start date", "employment start", "from date"], attrs: ["startdate", "start_date", "fromdate"] },
  { group: "experience", name: "endDate", label: "End date", words: ["end date", "employment end", "to date"], attrs: ["enddate", "end_date", "todate"] },
  { group: "experience", name: "description", label: "Description", long: true, words: ["job description", "responsibilities", "role description"], attrs: ["jobdescription", "responsibilities"] },

  // ---- Education (repeating; only the first entry is auto-filled) ----
  { group: "education", name: "school", label: "School", words: ["school", "university", "college", "institution"], attrs: ["school", "university", "college", "institution"] },
  { group: "education", name: "degree", label: "Degree", words: ["degree", "qualification"], attrs: ["degree", "qualification"] },
  { group: "education", name: "fieldOfStudy", label: "Field of study", words: ["field of study", "major", "discipline"], attrs: ["fieldofstudy", "major", "discipline"] },
  { group: "education", name: "startYear", label: "Start year", words: ["education start", "start year", "attended from"], attrs: ["startyear", "educationstart"] },
  { group: "education", name: "endYear", label: "End year", words: ["graduation year", "year of graduation", "completion year", "grad year", "end year"], attrs: ["graduationyear", "gradyear", "endyear", "completionyear"] },
  { group: "education", name: "location", label: "Location", words: ["school location", "university location"], attrs: ["schoollocation"] },
  { group: "education", name: "gpa", label: "GPA", words: ["gpa", "grade point"], attrs: ["gpa"] },

  // ---- Projects (repeating; stored & editable; not auto-matched) ----
  { group: "projects", name: "name", label: "Project name" },
  { group: "projects", name: "role", label: "Role" },
  { group: "projects", name: "description", label: "Description", long: true },
  { group: "projects", name: "technologies", label: "Technologies", list: true },
  { group: "projects", name: "url", label: "URL" },
  { group: "projects", name: "github", label: "GitHub" },
  { group: "projects", name: "startDate", label: "Start date" },
  { group: "projects", name: "endDate", label: "End date" },

  // ---- Certifications (repeating) -----------------------------------
  { group: "certifications", name: "name", label: "Certification name" },
  { group: "certifications", name: "issuer", label: "Issuer" },
  { group: "certifications", name: "issueDate", label: "Issue date" },
  { group: "certifications", name: "expiryDate", label: "Expiry date" },
  { group: "certifications", name: "credentialId", label: "Credential ID" },
  { group: "certifications", name: "credentialUrl", label: "Credential URL" },

  // ---- Awards (repeating) -------------------------------------------
  { group: "awards", name: "title", label: "Award title" },
  { group: "awards", name: "issuer", label: "Issuer" },
  { group: "awards", name: "date", label: "Date" },
  { group: "awards", name: "description", label: "Description", long: true },

  // ---- Volunteering (repeating) -------------------------------------
  { group: "volunteering", name: "organization", label: "Organization" },
  { group: "volunteering", name: "role", label: "Role" },
  { group: "volunteering", name: "startDate", label: "Start date" },
  { group: "volunteering", name: "endDate", label: "End date" },
  { group: "volunteering", name: "description", label: "Description", long: true }
];

// Flat form sections, in display order.
var AA_FORM_GROUPS = [
  { key: "personal", label: "Personal" },
  { key: "address", label: "Address" },
  { key: "links", label: "Links" },
  { key: "professional", label: "Professional" }
];

// Repeating list sections, in display order. Add one here (plus its fields in
// AA_FIELD_DEFS) to introduce a whole new repeating section.
var AA_REPEATER_GROUPS = [
  { key: "experience", label: "Experience", itemLabel: "Position" },
  { key: "education", label: "Education", itemLabel: "School" },
  { key: "projects", label: "Projects", itemLabel: "Project" },
  { key: "certifications", label: "Certifications", itemLabel: "Certification" },
  { key: "awards", label: "Awards", itemLabel: "Award" },
  { key: "volunteering", label: "Volunteering", itemLabel: "Role" }
];

// Canonical dotted key for a definition, e.g. "personal.firstName".
function aaFieldKey(def) { return def.group + "." + def.name; }

// Matcher view: every field reduced to { key, words, attrs }. (Fields with no
// words/attrs simply never match.) Consumed by lib/matcher.js.
function aaMatcherFields() {
  return AA_FIELD_DEFS.map(function (d) {
    return { key: aaFieldKey(d), words: d.words || [], attrs: d.attrs || [] };
  });
}

// Compact descriptor used by the Options form renderer.
function aaFieldDescriptor(d) {
  return { name: d.name, label: d.label, long: !!d.long, list: !!d.list };
}

// Options-form view of the flat sections: [{ key, label, fields:[descriptor] }].
function aaFormGroups() {
  return AA_FORM_GROUPS.map(function (g) {
    var fields = AA_FIELD_DEFS.filter(function (d) {
      return d.group === g.key && d.form !== false;
    }).map(aaFieldDescriptor);
    return { key: g.key, label: g.label, fields: fields };
  });
}

// Descriptors for one repeating section's fields.
function aaRepeaterFields(group) {
  return AA_FIELD_DEFS.filter(function (d) { return d.group === group; }).map(aaFieldDescriptor);
}

// Full repeating-section definitions: [{ key, label, itemLabel, fields }].
function aaRepeaterGroups() {
  return AA_REPEATER_GROUPS.map(function (g) {
    return { key: g.key, label: g.label, itemLabel: g.itemLabel, fields: aaRepeaterFields(g.key) };
  });
}

// Ensure a profile has a key for every registered flat field, so newly-added
// registry fields appear even on profiles saved by older versions. Only adds
// missing keys (list fields default to [], others to ""); never overwrites.
function aaEnsureProfileFields(profile) {
  if (!profile || typeof profile !== "object") return profile;
  AA_FORM_GROUPS.forEach(function (g) {
    if (!profile[g.key] || typeof profile[g.key] !== "object") profile[g.key] = {};
    AA_FIELD_DEFS.forEach(function (d) {
      if (d.group === g.key && d.form !== false && profile[g.key][d.name] === undefined) {
        profile[g.key][d.name] = d.list ? [] : "";
      }
    });
  });
  return profile;
}
