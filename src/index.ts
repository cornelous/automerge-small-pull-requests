import * as core from '@actions/core';
import * as github from '@actions/github';

async function run() {
  try {
    const token = core.getInput('github-token', { required: true });
    const maxFiles = Number(core.getInput('max-files', { required: true }));
    const forbiddenDirectories = core.getInput('forbidden-directories', { required: true }).split(',');
    const prPrefix = core.getInput('pr-prefix', { required: true });
    const mergeBackBranch = core.getInput('merge-back-branch', { required: true });

    const octokit = github.getOctokit(token);

    const pullRequestNumber = github.context.payload.pull_request?.number;

    if (!pullRequestNumber) {
      core.setFailed('Could not get pull request number from context');
      return;
    }

    const { data: pullRequest } = await octokit.pulls.get({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: pullRequestNumber,
    });

    //declare can_auto_merge variable and set it to true  
    core.setOutput('can_auto_merge', true);

    if (!pullRequest.head.ref.startsWith(prPrefix)) {
      core.info(`Pull request source branch "${pullRequest.head.ref}" does not start with "${prPrefix}". This pull request does not meet auto merging criteria.`);
      
      // declare variable can_auto_merge and set it to false  
      core.setOutput('can_auto_merge', false);
      return;
    }

    const { data: files } = await octokit.pulls.listFiles({
      owner: github.context.repo.owner,
      repo: github.context.repo.repo,
      pull_number: pullRequestNumber,
    });

    if (files.length >= maxFiles) {
      core.warning(`Pull request has changes in ${maxFiles} or more files`);
      core.setOutput('can_auto_merge', false);
      return;
    }

    if (files.some(file => forbiddenDirectories.some(dir => file.filename.startsWith(dir.trim())))) {
      core.warning('Pull request has changes in forbidden directories');
      core.setOutput('can_auto_merge', false);
      return;
    }

    // read core.setOutput('can_auto_merge') value
    const can_auto_merge = core.getInput('can_auto_merge');

    if (can_auto_merge == 'true') {
      await octokit.pulls.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: pullRequestNumber,
      });
  
      core.info('Pull request automatically merged successfully');
      // also add comment to PR
  
      const labelName = "auto-merged"
  
      try {
        await octokit.issues.createLabel({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          name: labelName,
          color: 'FFA500',
        });
      } catch (error) {
          if (error instanceof Error) {
            core.setFailed(`Action failed with error ${error.message}`);
          } else {
            core.setFailed(`Action failed with an unknown error`);
          }
      }
  
      await octokit.issues.addLabels({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: pullRequestNumber,
        labels: [labelName],
      });
  
      const { data: newPullRequest } = await octokit.pulls.create({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        title: `Merge ${pullRequest.head.ref} to ${mergeBackBranch}`,
        head: pullRequest.head.ref,
        base: mergeBackBranch,
      });
  
      await octokit.pulls.merge({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        pull_number: newPullRequest.number,
      });
  
      await octokit.issues.addLabels({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: newPullRequest.number,
        labels: [labelName],
      });
  
      core.info('New pull request to merge back branch created, merged, and labeled successfully');
    } 


  } catch (error) {
    core.setFailed(`Action failed with error ${error}`);
  }
}

run();