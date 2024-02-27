"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
const core = __importStar(require("@actions/core"));
const github = __importStar(require("@actions/github"));
async function run() {
    var _a;
    try {
        const token = core.getInput('github-token', { required: true });
        const maxFiles = Number(core.getInput('max-files', { required: true }));
        const forbiddenDirectories = core.getInput('forbidden-directories', { required: true }).split(',');
        const prPrefix = core.getInput('pr-prefix', { required: true });
        const mergeBackBranch = core.getInput('merge-back-branch', { required: true });
        const octokit = github.getOctokit(token);
        const pullRequestNumber = (_a = github.context.payload.pull_request) === null || _a === void 0 ? void 0 : _a.number;
        if (!pullRequestNumber) {
            core.setFailed('Could not get pull request number from context');
            return;
        }
        const { data: pullRequest } = await octokit.pulls.get({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pullRequestNumber,
        });
        if (!pullRequest.head.ref.startsWith(prPrefix)) {
            core.info(`Pull request source branch "${pullRequest.head.ref}" does not start with "${prPrefix}". This pull request does not meet auto merging criteria.`);
            return;
        }
        const { data: files } = await octokit.pulls.listFiles({
            owner: github.context.repo.owner,
            repo: github.context.repo.repo,
            pull_number: pullRequestNumber,
        });
        if (files.length >= maxFiles) {
            core.setFailed(`Pull request has changes in ${maxFiles} or more files`);
            return;
        }
        if (files.some(file => forbiddenDirectories.some(dir => file.filename.startsWith(dir.trim())))) {
            core.setFailed('Pull request has changes in forbidden directories');
            return;
        }
        // await octokit.pulls.merge({
        //   owner: github.context.repo.owner,
        //   repo: github.context.repo.repo,
        //   pull_number: pullRequestNumber,
        // });
        // core.info('Pull request merged successfully');
        const labelName = "auto-merged";
        try {
            await octokit.issues.createLabel({
                owner: github.context.repo.owner,
                repo: github.context.repo.repo,
                name: labelName,
                color: 'FFA500',
            });
        }
        catch (error) {
            if (error instanceof Error) {
                core.setFailed(`Action failed with error ${error.message}`);
            }
            else {
                core.setFailed(`Action failed with an unknown error`);
            }
        }
        // await octokit.issues.addLabels({
        //   owner: github.context.repo.owner,
        //   repo: github.context.repo.repo,
        //   issue_number: pullRequestNumber,
        //   labels: [labelName],
        // });
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
    catch (error) {
        core.setFailed(`Action failed with error ${error}`);
    }
}
run();
