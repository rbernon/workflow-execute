const core = require('@actions/core');
const github = require('@actions/github');

async function waitForSeconds(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000))
}

async function waitForWorkflowRun(octokit, owner, repo, run_id) {
  for (;;) {
    const run = await octokit.rest.actions.getWorkflowRun({
      owner: owner,
      repo: repo,
      run_id: run_id,
    });

    if (run.data.status === "completed") break;
    console.log(`Waiting for https://github.com/${owner}/${repo}/actions/runs/${run_id}...`);
    await waitForSeconds(10);
  }
}

async function waitForWorkflow(octokit, owner, repo, workflow, branch, event, date) {
  for (;;) {
    const runs = await octokit.rest.actions.listWorkflowRuns({
      owner: owner,
      repo: repo,
      workflow_id: workflow,
      branch: branch,
      event: event,
      created: `>=${date}`,
    });

    if (runs.data.total_count) return runs.data.workflow_runs[0].id;
    console.log(`Waiting for https://github.com/${owner}/${repo}/actions...`);
    await waitForSeconds(5);
  }
}

async function run() {
  try {
    const token = core.getInput('token', {required: false});
    let run_ids = core.getInput('run_ids', {required: false});

    const octokit = github.getOctokit(token);

    if (run_ids === "{}") {
      const date = new Date().toISOString();

      const repository = core.getInput('repository', {required: false});
      const workflow = core.getInput('workflow', {required: false});
      const branch = core.getInput('branch', {required: false});
      const inputs = JSON.parse(core.getInput('inputs', {required: false}));
      const wait = core.getInput('wait', {required: false});

      const [owner, repo] = repository.split('/');
      const ret = await octokit.rest.actions.createWorkflowDispatch({
        owner: owner,
        repo: repo,
        workflow_id: workflow,
        ref: branch,
        inputs: inputs,
      });

      const run_id = await waitForWorkflow(octokit, owner, repo, workflow, branch, "workflow_dispatch", date);
      console.log(`Dispatched https://github.com/${repository}/actions/runs/${run_id}`);
      core.setOutput("run_id", run_id);
      if (wait === "false") return;
      run_ids = {repository: run_id};
    } else {
      run_ids = JSON.parse(run_ids);
    }

    for (const [repository, run_id] of Object.entries(run_ids)) {
      const [owner, repo] = repository.split('/');
      await waitForWorkflowRun(octokit, owner, repo, run_id);
    }
    core.setOutput("run_ids", JSON.stringify(run_ids));
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
