const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const token = core.getInput('token', {required: false});
    const [owner, repo] = core.getInput('repository', {required: false}).split('/');
    const workflow = core.getInput('workflow', {required: false});
    const branch = core.getInput('branch', {required: false});
    const retain = core.getInput('retain_days', {required: false}) * 24 * 3600 * 1000;
    const keep = core.getInput('keep_count', {required: false});

    const octokit = github.getOctokit(token);

    console.log(`Listing runs for workflow ${owner}/${repo}#${workflow}`);
    const runs = await octokit.paginate(
      octokit.rest.actions.listWorkflowRuns,
      {owner: owner, repo: repo, workflow_id: workflow, branch: branch, per_page: 100},
      response => response.data.filter(run => {
        if (run.status !== "completed") return false;
        if (new Date().getTime() < new Date(run.created_at).getTime() + retain) return false;
        return true;
      })
    );

    if (runs.length <= keep) {
      console.log('No workflow runs need to be deleted.');
    } else {
      for (const run of runs.slice(keep)) {
        console.log(`Deleting workflow run ${run.id}.`);
        await octokit.rest.actions.deleteWorkflowRun({
          owner: owner,
          repo: repo,
          run_id: run.id,
        });
        console.log(`Deleted workflow run ${run.id}.`);
      }
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
