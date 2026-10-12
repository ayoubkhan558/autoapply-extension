// Service-worker public AI facade. Load provider, tasks, and models first.
// Classic-script module; dependency order is declared in config/modules.json.
if (typeof self !== "undefined") {
  self.aaCallProvider = aaCallProvider;
  self.aaAnalyzeJob = aaAnalyzeJob;
  self.aaAnswerQuestions = aaAnswerQuestions;
  self.aaGenerateApplication = aaGenerateApplication;
  self.aaListModels = aaListModels;
}
