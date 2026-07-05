#!/usr/bin/env node

/**
 * GSD Tools — CLI utility for GSD workflow operations
 *
 * Replaces repetitive inline bash patterns across ~50 GSD command/workflow/agent files.
 * Centralizes: config parsing, model resolution, phase lookup, git commits, summary verification.
 *
 * Usage: node gsd-tools.cjs <command> [args] [--raw]
 *
 * Atomic Commands:
 *   state load                         Load project config + state
 *   state json                         Output STATE.md frontmatter as JSON
 *   state update <field> <value>       Update a STATE.md field
 *   state get [section]                Get STATE.md content or section
 *   state patch --field val ...        Batch update STATE.md fields
 *   state begin-phase --phase N --name S --plans C  Update STATE.md for new phase start
 *   state signal-waiting --type T --question Q --options "A|B" --phase P  Write WAITING.json signal
 *   state signal-resume                Remove WAITING.json signal
 *   resolve-model <agent-type>         Get model for agent based on profile
 *   find-phase <phase>                 Find phase directory by number
 *   commit <message> [--files f1 f2] [--no-verify]   Commit planning docs
 *   verify-summary <path>              Verify a SUMMARY.md file
 *   generate-slug <text>               Convert text to URL-safe slug
 *   current-timestamp [format]         Get timestamp (full|date|filename)
 *   list-todos [area]                  Count and enumerate pending todos
 *   verify-path-exists <path>          Check file/directory existence
 *   config-ensure-section              Initialize .planning/config.json
 *   history-digest                     Aggregate all SUMMARY.md data
 *   summary-extract <path> [--fields]  Extract structured data from SUMMARY.md
 *   state-snapshot                     Structured parse of STATE.md
 *   phase-plan-index <phase>           Index plans with waves and status
 *   websearch <query>                  Search web via Brave API (if configured)
 *     [--limit N] [--freshness day|week|month]
 *
 * Phase Operations:
 *   phase next-decimal <phase>         Calculate next decimal phase number
 *   phase add <description> [--id ID]   Append new phase to roadmap + create dir
 *   phase insert <after> <description> Insert decimal phase after existing
 *   phase remove <phase> [--force]     Remove phase, renumber all subsequent
 *   phase complete <phase>             Mark phase done, update state + roadmap
 *
 * Roadmap Operations:
 *   roadmap get-phase <phase>          Extract phase section from ROADMAP.md
 *   roadmap analyze                    Full roadmap parse with disk status
 *   roadmap update-plan-progress <N>   Update progress table row from disk (PLAN vs SUMMARY counts)
 *   roadmap frontier                   Runnable frontier (hard-deps satisfied) + axis-A co-schedule split
 *
 * Requirements Operations:
 *   requirements mark-complete <ids>   Mark requirement IDs as complete in REQUIREMENTS.md
 *                                      Accepts: REQ-01,REQ-02 or REQ-01 REQ-02 or [REQ-01, REQ-02]
 *
 * Milestone Operations:
 *   milestone complete <version>       Archive milestone, create MILESTONES.md
 *     [--name <name>]                   (also writes .planning/{version}/SUMMARY.md
 *     [--archive-phases]                 distillation artifact as side-effect)
 *                                       Move phase dirs to milestones/vX.Y-phases/
 *
 *   milestone distill <version>        Write .planning/{version}/SUMMARY.md with
 *     [--name <name>]                   typed-tag sections: decisions[],
 *     [--dry-run]                        requirements_validated[], open_blockers[],
 *                                        entry_points[], public_api[] — graph-friendly
 *                                        substrate for Phase 6 indexing.
 *
 *   migrate-to-milestone-partition     Retrofit legacy .planning/phases/ tree into
 *     [--dry-run]                       milestone-partitioned .planning/{milestone}/phases/
 *     [--yes]                           layout. Prints plan, prompts [y/N], git mv preserves
 *                                        history, single-commit transaction, manifest-driven
 *                                        crash recovery.
 *
 * Worktree Operations (SC1 — parallel executor isolation):
 *   worktree add <dir> <branch>        Create linked worktree; detect-existing + ignore-check
 *     [--base <branch>]                Sandbox failure → {ok:false, fallback:"in-place"}
 *   worktree merge <branch>            Merge branch into current; per-merge clean check
 *                                     Returns {clean:bool, conflict_files:[]}; NEVER aborts on conflict
 *   worktree remove <dir>              Remove worktree + delete branch
 *     [--branch <branch>] [--force]
 *   worktree prune                     git worktree prune (clean stale entries)
 *
 * Parallel Safety Gate (SC2 + SC3 — concurrent session safety):
 *   parallel-safe <A> <B>              Decide if units A and B can run concurrently
 *                                      A/B: phase number OR todo slug
 *                                      → JSON: {safe, axis_b_coupled, axis_a_overlap,
 *                                               overlap_files, decision, reason}
 *                                      decision: "refuse" (axis-B depends_on edge — unrecoverable)
 *                                              | "warn"   (axis-A file overlap only — reviewable)
 *                                              | "greenlight" (disjoint on both axes)
 *
 * Validation:
 *   validate consistency               Check phase numbering, disk/roadmap sync
 *   validate health [--repair]         Check .planning/ integrity, optionally repair
 *
 * Progress:
 *   progress [json|table|bar]          Render progress in various formats
 *
 * Todos:
 *   todo complete <filename>           Move todo from pending to completed
 *
 * UAT Audit:
 *   audit-uat                           Scan all phases for unresolved UAT/verification items
 *
 * Scaffolding:
 *   scaffold context --phase <N>       Create CONTEXT.md template
 *   scaffold uat --phase <N>           Create UAT.md template
 *   scaffold verification --phase <N>  Create VERIFICATION.md template
 *   scaffold phase-dir --phase <N>     Create phase directory
 *     --name <name>
 *
 * Frontmatter CRUD:
 *   frontmatter get <file> [--field k] Extract frontmatter as JSON
 *   frontmatter set <file> --field k   Update single frontmatter field
 *     --value jsonVal
 *   frontmatter merge <file>           Merge JSON into frontmatter
 *     --data '{json}'
 *   frontmatter validate <file>        Validate required fields
 *     --schema plan|summary|verification
 *
 * Verification Suite:
 *   verify plan-structure <file>       Check PLAN.md structure + tasks
 *   verify phase-completeness <phase>  Check all plans have summaries
 *   verify references <file>           Check @-refs + paths resolve
 *   verify commits <h1> [h2] ...      Batch verify commit hashes
 *   verify artifacts <plan-file>       Check must_haves.artifacts
 *   verify key-links <plan-file>       Check must_haves.key_links
 *   verify commands <plan-file>        Run must_haves.truths[].verify[] cmds
 *
 * State Progression:
 *   state advance-plan                 Increment plan counter
 *   state record-metric --phase N      Record execution metrics
 *     --plan M --duration Xmin
 *     [--tasks N] [--files N]
 *   state update-progress              Recalculate progress bar
 *   state add-decision --summary "..."  Add decision to STATE.md
 *     [--phase N] [--rationale "..."]
 *     [--summary-file path] [--rationale-file path]
 *   state add-blocker --text "..."     Add blocker
 *     [--text-file path]
 *   state resolve-blocker --text "..." Remove blocker
 *   state record-session               Update session continuity
 *     --stopped-at "..."
 *     [--resume-file path]
 *
 * Compound Commands (workflow-specific initialization):
 *   init execute-phase <phase>         All context for execute-phase workflow
 *   init plan-phase <phase>            All context for plan-phase workflow
 *   init new-project                   All context for new-project workflow
 *   init new-milestone                 All context for new-milestone workflow
 *   init quick "<description>"         All context for quick (ad-hoc task) workflow
 *   init resume                        All context for resume-project workflow
 *   init verify-work <phase>           All context for verify-work workflow
 *   init phase-op <phase>              Generic phase operation context
 *   init todos [area]                  All context for todo workflows
 *   init milestone-op                  All context for milestone operations
 *   init map-codebase                  All context for map-codebase workflow
 *   init progress                      All context for progress workflow
 *   init document                      All context for document workflow
 */

const fs = require('fs');
const path = require('path');
const { error } = require('./lib/core.cjs');
const state = require('./lib/state.cjs');
const phase = require('./lib/phase.cjs');
const roadmap = require('./lib/roadmap.cjs');
const verify = require('./lib/verify.cjs');
const config = require('./lib/config.cjs');
const milestone = require('./lib/milestone.cjs');
const commands = require('./lib/commands.cjs');
const init = require('./lib/init.cjs');
const frontmatter = require('./lib/frontmatter.cjs');
const profilePipeline = require('./lib/profile-pipeline.cjs');
const trace = require('./lib/trace.cjs');
const lesson = require('./lib/lesson.cjs');
const ledger = require('./lib/ledger.cjs');
const mailbox = require('./lib/mailbox.cjs');
const park = require('./lib/park.cjs');
const triage = require('./lib/triage.cjs');
const discussLoop = require('./lib/discuss-loop.cjs');
const profileOutput = require('./lib/profile-output.cjs');
const worktree = require('./lib/worktree.cjs');
const parallelGate = require('./lib/parallel-gate.cjs');
const graph = require('./lib/graph.cjs');

// ─── CLI Router ───────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  // Optional cwd override for sandboxed subagents running outside project root.
  let cwd = process.cwd();
  const cwdEqArg = args.find(arg => arg.startsWith('--cwd='));
  const cwdIdx = args.indexOf('--cwd');
  if (cwdEqArg) {
    const value = cwdEqArg.slice('--cwd='.length).trim();
    if (!value) error('Missing value for --cwd');
    args.splice(args.indexOf(cwdEqArg), 1);
    cwd = path.resolve(value);
  } else if (cwdIdx !== -1) {
    const value = args[cwdIdx + 1];
    if (!value || value.startsWith('--')) error('Missing value for --cwd');
    args.splice(cwdIdx, 2);
    cwd = path.resolve(value);
  }

  if (!fs.existsSync(cwd) || !fs.statSync(cwd).isDirectory()) {
    error(`Invalid --cwd: ${cwd}`);
  }

  const rawIndex = args.indexOf('--raw');
  const raw = rawIndex !== -1;
  if (rawIndex !== -1) args.splice(rawIndex, 1);

  const command = args[0];

  if (!command) {
    error('Usage: gsd-tools <command> [args] [--raw] [--cwd <path>]\nCommands: state, resolve-model, find-phase, commit, verify-summary, verify, frontmatter, generate-slug, current-timestamp, list-todos, verify-path-exists, config-ensure-section, init');
  }

  switch (command) {
    case 'state': {
      const subcommand = args[1];
      if (subcommand === 'json') {
        state.cmdStateJson(cwd, raw);
      } else if (subcommand === 'update') {
        state.cmdStateUpdate(cwd, args[2], args[3]);
      } else if (subcommand === 'get') {
        state.cmdStateGet(cwd, args[2], raw);
      } else if (subcommand === 'patch') {
        const patches = {};
        for (let i = 2; i < args.length; i += 2) {
          const key = args[i].replace(/^--/, '');
          const value = args[i + 1];
          if (key && value !== undefined) {
            patches[key] = value;
          }
        }
        state.cmdStatePatch(cwd, patches, raw);
      } else if (subcommand === 'advance-plan') {
        state.cmdStateAdvancePlan(cwd, raw);
      } else if (subcommand === 'record-metric') {
        const phaseIdx = args.indexOf('--phase');
        const planIdx = args.indexOf('--plan');
        const durationIdx = args.indexOf('--duration');
        const tasksIdx = args.indexOf('--tasks');
        const filesIdx = args.indexOf('--files');
        state.cmdStateRecordMetric(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          plan: planIdx !== -1 ? args[planIdx + 1] : null,
          duration: durationIdx !== -1 ? args[durationIdx + 1] : null,
          tasks: tasksIdx !== -1 ? args[tasksIdx + 1] : null,
          files: filesIdx !== -1 ? args[filesIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'update-progress') {
        state.cmdStateUpdateProgress(cwd, raw);
      } else if (subcommand === 'add-decision') {
        const phaseIdx = args.indexOf('--phase');
        const summaryIdx = args.indexOf('--summary');
        const summaryFileIdx = args.indexOf('--summary-file');
        const rationaleIdx = args.indexOf('--rationale');
        const rationaleFileIdx = args.indexOf('--rationale-file');
        state.cmdStateAddDecision(cwd, {
          phase: phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          summary: summaryIdx !== -1 ? args[summaryIdx + 1] : null,
          summary_file: summaryFileIdx !== -1 ? args[summaryFileIdx + 1] : null,
          rationale: rationaleIdx !== -1 ? args[rationaleIdx + 1] : '',
          rationale_file: rationaleFileIdx !== -1 ? args[rationaleFileIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'add-blocker') {
        const textIdx = args.indexOf('--text');
        const textFileIdx = args.indexOf('--text-file');
        state.cmdStateAddBlocker(cwd, {
          text: textIdx !== -1 ? args[textIdx + 1] : null,
          text_file: textFileIdx !== -1 ? args[textFileIdx + 1] : null,
        }, raw);
      } else if (subcommand === 'resolve-blocker') {
        const textIdx = args.indexOf('--text');
        state.cmdStateResolveBlocker(cwd, textIdx !== -1 ? args[textIdx + 1] : null, raw);
      } else if (subcommand === 'record-session') {
        const stoppedIdx = args.indexOf('--stopped-at');
        const resumeIdx = args.indexOf('--resume-file');
        state.cmdStateRecordSession(cwd, {
          stopped_at: stoppedIdx !== -1 ? args[stoppedIdx + 1] : null,
          resume_file: resumeIdx !== -1 ? args[resumeIdx + 1] : 'None',
        }, raw);
      } else if (subcommand === 'begin-phase') {
        const phaseIdx = args.indexOf('--phase');
        const nameIdx = args.indexOf('--name');
        const plansIdx = args.indexOf('--plans');
        state.cmdStateBeginPhase(
          cwd,
          phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          nameIdx !== -1 ? args[nameIdx + 1] : null,
          plansIdx !== -1 ? parseInt(args[plansIdx + 1], 10) : null,
          raw
        );
      } else if (subcommand === 'signal-waiting') {
        const typeIdx = args.indexOf('--type');
        const qIdx = args.indexOf('--question');
        const optIdx = args.indexOf('--options');
        const phaseIdx = args.indexOf('--phase');
        state.cmdSignalWaiting(
          cwd,
          typeIdx !== -1 ? args[typeIdx + 1] : null,
          qIdx !== -1 ? args[qIdx + 1] : null,
          optIdx !== -1 ? args[optIdx + 1] : null,
          phaseIdx !== -1 ? args[phaseIdx + 1] : null,
          raw
        );
      } else if (subcommand === 'signal-resume') {
        state.cmdSignalResume(cwd, raw);
      } else {
        state.cmdStateLoad(cwd, raw);
      }
      break;
    }

    case 'resolve-model': {
      commands.cmdResolveModel(cwd, args[1], raw);
      break;
    }

    case 'find-phase': {
      phase.cmdFindPhase(cwd, args[1], raw);
      break;
    }

    case 'commit': {
      const amend = args.includes('--amend');
      const noVerify = args.includes('--no-verify');
      const filesIndex = args.indexOf('--files');
      // Collect all positional args between command name and first flag,
      // then join them — handles both quoted ("multi word msg") and
      // unquoted (multi word msg) invocations from different shells
      const endIndex = filesIndex !== -1 ? filesIndex : args.length;
      const messageArgs = args.slice(1, endIndex).filter(a => !a.startsWith('--'));
      const message = messageArgs.join(' ') || undefined;
      const files = filesIndex !== -1 ? args.slice(filesIndex + 1).filter(a => !a.startsWith('--')) : [];
      commands.cmdCommit(cwd, message, files, raw, amend, noVerify);
      break;
    }

    case 'verify-summary': {
      const summaryPath = args[1];
      const countIndex = args.indexOf('--check-count');
      const checkCount = countIndex !== -1 ? parseInt(args[countIndex + 1], 10) : 2;
      verify.cmdVerifySummary(cwd, summaryPath, checkCount, raw);
      break;
    }

    case 'frontmatter': {
      const subcommand = args[1];
      const file = args[2];
      if (subcommand === 'get') {
        const fieldIdx = args.indexOf('--field');
        frontmatter.cmdFrontmatterGet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, raw);
      } else if (subcommand === 'set') {
        const fieldIdx = args.indexOf('--field');
        const valueIdx = args.indexOf('--value');
        frontmatter.cmdFrontmatterSet(cwd, file, fieldIdx !== -1 ? args[fieldIdx + 1] : null, valueIdx !== -1 ? args[valueIdx + 1] : undefined, raw);
      } else if (subcommand === 'merge') {
        const dataIdx = args.indexOf('--data');
        frontmatter.cmdFrontmatterMerge(cwd, file, dataIdx !== -1 ? args[dataIdx + 1] : null, raw);
      } else if (subcommand === 'validate') {
        const schemaIdx = args.indexOf('--schema');
        frontmatter.cmdFrontmatterValidate(cwd, file, schemaIdx !== -1 ? args[schemaIdx + 1] : null, raw);
      } else {
        error('Unknown frontmatter subcommand. Available: get, set, merge, validate');
      }
      break;
    }

    case 'verify': {
      const subcommand = args[1];
      if (subcommand === 'plan-structure') {
        verify.cmdVerifyPlanStructure(cwd, args[2], raw);
      } else if (subcommand === 'phase-completeness') {
        verify.cmdVerifyPhaseCompleteness(cwd, args[2], raw);
      } else if (subcommand === 'references') {
        verify.cmdVerifyReferences(cwd, args[2], raw);
      } else if (subcommand === 'commits') {
        verify.cmdVerifyCommits(cwd, args.slice(2), raw);
      } else if (subcommand === 'artifacts') {
        verify.cmdVerifyArtifacts(cwd, args[2], raw);
      } else if (subcommand === 'key-links') {
        verify.cmdVerifyKeyLinks(cwd, args[2], raw);
      } else if (subcommand === 'commands') {
        verify.cmdVerifyCommands(cwd, args[2], raw);
      } else {
        error('Unknown verify subcommand. Available: plan-structure, phase-completeness, references, commits, artifacts, key-links, commands');
      }
      break;
    }

    case 'generate-slug': {
      commands.cmdGenerateSlug(args[1], raw);
      break;
    }

    case 'current-timestamp': {
      commands.cmdCurrentTimestamp(args[1] || 'full', raw);
      break;
    }

    case 'list-todos': {
      commands.cmdListTodos(cwd, args[1], raw);
      break;
    }

    case 'verify-path-exists': {
      commands.cmdVerifyPathExists(cwd, args[1], raw);
      break;
    }

    case 'config-ensure-section': {
      config.cmdConfigEnsureSection(cwd, raw);
      break;
    }

    case 'config-set': {
      config.cmdConfigSet(cwd, args[1], args[2], raw);
      break;
    }

    case "config-set-model-profile": {
      config.cmdConfigSetModelProfile(cwd, args[1], raw);
      break;
    }

    case 'config-get': {
      config.cmdConfigGet(cwd, args[1], raw);
      break;
    }

    case 'history-digest': {
      commands.cmdHistoryDigest(cwd, raw);
      break;
    }

    case 'phases': {
      const subcommand = args[1];
      if (subcommand === 'list') {
        const typeIndex = args.indexOf('--type');
        const phaseIndex = args.indexOf('--phase');
        const options = {
          type: typeIndex !== -1 ? args[typeIndex + 1] : null,
          phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
          includeArchived: args.includes('--include-archived'),
        };
        phase.cmdPhasesList(cwd, options, raw);
      } else {
        error('Unknown phases subcommand. Available: list');
      }
      break;
    }

    case 'roadmap': {
      const subcommand = args[1];
      if (subcommand === 'get-phase') {
        roadmap.cmdRoadmapGetPhase(cwd, args[2], raw);
      } else if (subcommand === 'analyze') {
        const scoped = args.includes('--scoped');
        roadmap.cmdRoadmapAnalyze(cwd, raw, { scoped });
      } else if (subcommand === 'update-plan-progress') {
        roadmap.cmdRoadmapUpdatePlanProgress(cwd, args[2], raw);
      } else if (subcommand === 'frontier') {
        roadmap.cmdRoadmapFrontier(cwd, raw);
      } else {
        error('Unknown roadmap subcommand. Available: get-phase, analyze, update-plan-progress, frontier');
      }
      break;
    }

    case 'requirements': {
      const subcommand = args[1];
      if (subcommand === 'mark-complete') {
        milestone.cmdRequirementsMarkComplete(cwd, args.slice(2), raw);
      } else {
        error('Unknown requirements subcommand. Available: mark-complete');
      }
      break;
    }

    case 'phase': {
      const subcommand = args[1];
      if (subcommand === 'next-decimal') {
        phase.cmdPhaseNextDecimal(cwd, args[2], raw);
      } else if (subcommand === 'next-backlog-id') {
        phase.cmdPhaseNextBacklogId(cwd, raw);
      } else if (subcommand === 'add') {
        const idIdx = args.indexOf('--id');
        let customId = null;
        const descArgs = [];
        for (let i = 2; i < args.length; i++) {
          if (args[i] === '--id' && i + 1 < args.length) {
            customId = args[i + 1];
            i++; // skip value
          } else {
            descArgs.push(args[i]);
          }
        }
        phase.cmdPhaseAdd(cwd, descArgs.join(' '), raw, customId);
      } else if (subcommand === 'insert') {
        phase.cmdPhaseInsert(cwd, args[2], args.slice(3).join(' '), raw);
      } else if (subcommand === 'remove') {
        const forceFlag = args.includes('--force');
        phase.cmdPhaseRemove(cwd, args[2], { force: forceFlag }, raw);
      } else if (subcommand === 'complete') {
        phase.cmdPhaseComplete(cwd, args[2], raw);
      } else {
        error('Unknown phase subcommand. Available: next-decimal, next-backlog-id, add, insert, remove, complete');
      }
      break;
    }

    case 'migrate-to-milestone-partition': {
      const migration = require('./lib/migration.cjs');
      const opts = {
        dryRun: args.includes('--dry-run'),
        yes: args.includes('--yes'),
      };
      await migration.cmdMigrateToMilestonePartition(cwd, opts, raw);
      break;
    }

    case 'milestone': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        const nameIndex = args.indexOf('--name');
        const archivePhases = args.includes('--archive-phases');
        // Collect --name value (everything after --name until next flag or end)
        let milestoneName = null;
        if (nameIndex !== -1) {
          const nameArgs = [];
          for (let i = nameIndex + 1; i < args.length; i++) {
            if (args[i].startsWith('--')) break;
            nameArgs.push(args[i]);
          }
          milestoneName = nameArgs.join(' ') || null;
        }
        milestone.cmdMilestoneComplete(cwd, args[2], { name: milestoneName, archivePhases }, raw);
      } else if (subcommand === 'distill') {
        // milestone distill <version> [--name "Display Name"] [--dry-run]
        // --dry-run does NOT skip the write (file is needed by callers); it
        // forces JSON output even when --raw is set, so callers can inspect.
        const nameIndex = args.indexOf('--name');
        let milestoneName = null;
        if (nameIndex !== -1) {
          const nameArgs = [];
          for (let i = nameIndex + 1; i < args.length; i++) {
            if (args[i].startsWith('--')) break;
            nameArgs.push(args[i]);
          }
          milestoneName = nameArgs.join(' ') || null;
        }
        const dryRun = args.includes('--dry-run');
        milestone.cmdMilestoneDistill(cwd, args[2], { name: milestoneName, dryRun }, raw && !dryRun);
      } else {
        error('Unknown milestone subcommand. Available: complete, distill');
      }
      break;
    }

    case 'validate': {
      const subcommand = args[1];
      if (subcommand === 'consistency') {
        verify.cmdValidateConsistency(cwd, raw);
      } else if (subcommand === 'health') {
        const repairFlag = args.includes('--repair');
        verify.cmdValidateHealth(cwd, { repair: repairFlag }, raw);
      } else {
        error('Unknown validate subcommand. Available: consistency, health');
      }
      break;
    }

    case 'worktree': {
      worktree.cmdWorktree(cwd, args, raw);
      break;
    }

    case 'parallel-safe': {
      parallelGate.cmdParallelSafe(cwd, args[1], args[2], raw);
      break;
    }

    case 'progress': {
      const subcommand = args[1] || 'json';
      commands.cmdProgressRender(cwd, subcommand, raw);
      break;
    }

    case 'audit-uat': {
      const uat = require('./lib/uat.cjs');
      uat.cmdAuditUat(cwd, raw);
      break;
    }

    case 'stats': {
      const subcommand = args[1] || 'json';
      commands.cmdStats(cwd, subcommand, raw);
      break;
    }

    case 'todo': {
      const subcommand = args[1];
      if (subcommand === 'complete') {
        commands.cmdTodoComplete(cwd, args[2], raw);
      } else if (subcommand === 'match-phase') {
        commands.cmdTodoMatchPhase(cwd, args[2], raw);
      } else {
        error('Unknown todo subcommand. Available: complete, match-phase');
      }
      break;
    }

    case 'scaffold': {
      const scaffoldType = args[1];
      const phaseIndex = args.indexOf('--phase');
      const nameIndex = args.indexOf('--name');
      const scaffoldOptions = {
        phase: phaseIndex !== -1 ? args[phaseIndex + 1] : null,
        name: nameIndex !== -1 ? args.slice(nameIndex + 1).join(' ') : null,
      };
      commands.cmdScaffold(cwd, scaffoldType, scaffoldOptions, raw);
      break;
    }

    case 'init': {
      const workflow = args[1];
      switch (workflow) {
        case 'execute-phase':
          init.cmdInitExecutePhase(cwd, args[2], raw);
          break;
        case 'plan-phase':
          init.cmdInitPlanPhase(cwd, args[2], raw);
          break;
        case 'new-project':
          init.cmdInitNewProject(cwd, raw);
          break;
        case 'new-milestone':
          init.cmdInitNewMilestone(cwd, raw);
          break;
        case 'quick':
          init.cmdInitQuick(cwd, args[2], raw);
          break;
        case 'resume':
          init.cmdInitResume(cwd, raw);
          break;
        case 'verify-work':
          init.cmdInitVerifyWork(cwd, args[2], raw);
          break;
        case 'phase-op':
          init.cmdInitPhaseOp(cwd, args[2], raw);
          break;
        case 'todos':
          init.cmdInitTodos(cwd, args[2], raw);
          break;
        case 'milestone-op':
          init.cmdInitMilestoneOp(cwd, raw);
          break;
        case 'map-codebase':
          init.cmdInitMapCodebase(cwd, raw);
          break;
        case 'progress': {
          const scoped = args.includes('--scoped');
          init.cmdInitProgress(cwd, raw, { scoped });
          break;
        }
        case 'document':
          init.cmdInitDocument(cwd, raw);
          break;
        default:
          error(`Unknown init workflow: ${workflow}\nAvailable: execute-phase, plan-phase, new-project, new-milestone, quick, resume, verify-work, phase-op, todos, milestone-op, map-codebase, progress, document`);
      }
      break;
    }

    case 'phase-plan-index': {
      phase.cmdPhasePlanIndex(cwd, args[1], raw);
      break;
    }

    case 'state-snapshot': {
      state.cmdStateSnapshot(cwd, raw);
      break;
    }

    case 'summary-extract': {
      const summaryPath = args[1];
      const fieldsIndex = args.indexOf('--fields');
      const fields = fieldsIndex !== -1 ? args[fieldsIndex + 1].split(',') : null;
      commands.cmdSummaryExtract(cwd, summaryPath, fields, raw);
      break;
    }

    case 'trace': {
      const sIdx = args.indexOf('--session');
      const aIdx = args.indexOf('--agent');
      const cIdx = args.indexOf('--confidence');
      const lIdx = args.indexOf('--last');
      const opts = {
        session: sIdx !== -1 ? args[sIdx + 1] : null,
        agent: aIdx !== -1 ? args[aIdx + 1] : null,
        confidence: cIdx !== -1 ? args[cIdx + 1] : null,
        last: lIdx !== -1 ? parseInt(args[lIdx + 1], 10) : 20,
      };
      trace.cmdTrace(cwd, opts, raw);
      break;
    }

    case 'websearch': {
      const query = args[1];
      const limitIdx = args.indexOf('--limit');
      const freshnessIdx = args.indexOf('--freshness');
      await commands.cmdWebsearch(query, {
        limit: limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 10,
        freshness: freshnessIdx !== -1 ? args[freshnessIdx + 1] : null,
      }, raw);
      break;
    }

    // ─── Profiling Pipeline ────────────────────────────────────────────────

    case 'scan-sessions': {
      const pathIdx = args.indexOf('--path');
      const sessionsPath = pathIdx !== -1 ? args[pathIdx + 1] : null;
      const verboseFlag = args.includes('--verbose');
      const jsonFlag = args.includes('--json');
      await profilePipeline.cmdScanSessions(sessionsPath, { verbose: verboseFlag, json: jsonFlag }, raw);
      break;
    }

    case 'extract-messages': {
      const sessionIdx = args.indexOf('--session');
      const sessionId = sessionIdx !== -1 ? args[sessionIdx + 1] : null;
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : null;
      const pathIdx = args.indexOf('--path');
      const sessionsPath = pathIdx !== -1 ? args[pathIdx + 1] : null;
      const projectArg = args[1];
      if (!projectArg || projectArg.startsWith('--')) {
        error('Usage: gsd-tools extract-messages <project> [--session <id>] [--limit N] [--path <dir>]\nRun scan-sessions first to see available projects.');
      }
      await profilePipeline.cmdExtractMessages(projectArg, { sessionId, limit }, raw, sessionsPath);
      break;
    }

    case 'profile-sample': {
      const pathIdx = args.indexOf('--path');
      const sessionsPath = pathIdx !== -1 ? args[pathIdx + 1] : null;
      const limitIdx = args.indexOf('--limit');
      const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) : 150;
      const maxPerIdx = args.indexOf('--max-per-project');
      const maxPerProject = maxPerIdx !== -1 ? parseInt(args[maxPerIdx + 1], 10) : null;
      const maxCharsIdx = args.indexOf('--max-chars');
      const maxChars = maxCharsIdx !== -1 ? parseInt(args[maxCharsIdx + 1], 10) : 500;
      await profilePipeline.cmdProfileSample(sessionsPath, { limit, maxPerProject, maxChars }, raw);
      break;
    }

    // ─── Profile Output ──────────────────────────────────────────────────

    case 'write-profile': {
      const inputIdx = args.indexOf('--input');
      const inputPath = inputIdx !== -1 ? args[inputIdx + 1] : null;
      if (!inputPath) error('--input <analysis-json-path> is required');
      const outputIdx = args.indexOf('--output');
      const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;
      profileOutput.cmdWriteProfile(cwd, { input: inputPath, output: outputPath }, raw);
      break;
    }

    case 'profile-questionnaire': {
      const answersIdx = args.indexOf('--answers');
      const answers = answersIdx !== -1 ? args[answersIdx + 1] : null;
      profileOutput.cmdProfileQuestionnaire({ answers }, raw);
      break;
    }

    case 'generate-dev-preferences': {
      const analysisIdx = args.indexOf('--analysis');
      const analysisPath = analysisIdx !== -1 ? args[analysisIdx + 1] : null;
      const outputIdx = args.indexOf('--output');
      const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;
      const stackIdx = args.indexOf('--stack');
      const stack = stackIdx !== -1 ? args[stackIdx + 1] : null;
      profileOutput.cmdGenerateDevPreferences(cwd, { analysis: analysisPath, output: outputPath, stack }, raw);
      break;
    }

    case 'generate-claude-profile': {
      const analysisIdx = args.indexOf('--analysis');
      const analysisPath = analysisIdx !== -1 ? args[analysisIdx + 1] : null;
      const outputIdx = args.indexOf('--output');
      const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;
      const globalFlag = args.includes('--global');
      profileOutput.cmdGenerateClaudeProfile(cwd, { analysis: analysisPath, output: outputPath, global: globalFlag }, raw);
      break;
    }

    case 'generate-claude-md': {
      const outputIdx = args.indexOf('--output');
      const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : null;
      const autoFlag = args.includes('--auto');
      const forceFlag = args.includes('--force');
      profileOutput.cmdGenerateClaudeMd(cwd, { output: outputPath, auto: autoFlag, force: forceFlag }, raw);
      break;
    }

    case 'lesson': {
      const sub = args[1];

      switch (sub) {
        case 'append': {
          const jsonString = args[2];
          if (!jsonString) { process.stderr.write('lesson append <json> is required\n'); process.exit(1); }
          lesson.cmdAppend(cwd, jsonString);
          break;
        }
        case 'list': {
          const aIdx = args.indexOf('--agent');
          const dIdx = args.indexOf('--disposition');
          const lIdx = args.indexOf('--last');
          const opts = {
            agent: aIdx !== -1 ? args[aIdx + 1] : null,
            disposition: dIdx !== -1 ? args[dIdx + 1] : null,
            last: lIdx !== -1 ? parseInt(args[lIdx + 1], 10) : 20,
          };
          lesson.cmdList(cwd, opts, raw);
          break;
        }
        case 'update': {
          const id = args[2];
          if (!id) { process.stderr.write('lesson update <id> is required\n'); process.exit(1); }
          const dIdx = args.indexOf('--disposition');
          const cIdx = args.indexOf('--commit');
          lesson.cmdUpdate(cwd, id, {
            disposition: dIdx !== -1 ? args[dIdx + 1] : null,
            commit: cIdx !== -1 ? args[cIdx + 1] : null,
          });
          break;
        }
        case 'bump-recurrence': {
          const id = args[2];
          if (!id) { process.stderr.write('lesson bump-recurrence <id> is required\n'); process.exit(1); }
          lesson.cmdBumpRecurrence(cwd, id);
          break;
        }
        case 'attribute': {
          const aIdx = args.indexOf('--agent');
          const lIdx = args.indexOf('--last');
          const opts = {
            agent: aIdx !== -1 ? args[aIdx + 1] : null,
            last: lIdx !== -1 ? parseInt(args[lIdx + 1], 10) : 50,
          };
          lesson.cmdAttribute(cwd, opts, raw);
          break;
        }
        case 'scan': {
          lesson.cmdScan(cwd, {});
          break;
        }
        default:
          process.stderr.write(`lesson: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'ledger': {
      const sub = args[1];
      const runId = args[2];

      switch (sub) {
        case 'append': {
          // ledger append <run-id> --data <json>
          // runId may be a run-id or '--data' if user omitted run-id (env fallback)
          let effectiveRunId = runId;
          let dataIdx;
          if (runId === '--data') {
            // no explicit run-id; env fallback path
            effectiveRunId = undefined;
            dataIdx = args.indexOf('--data');
          } else {
            dataIdx = args.indexOf('--data');
          }
          const jsonString = dataIdx !== -1 ? args[dataIdx + 1] : null;
          if (!jsonString) {
            process.stderr.write('ledger append <run-id> --data <json>\n');
            process.exit(1);
          }
          ledger.cmdLedgerAppend(cwd, effectiveRunId, jsonString);
          break;
        }
        case 'list':
        case 'filter': {
          // ledger list <run-id> [--phase N] [--escalated] [--raw]
          const phaseIdx = args.indexOf('--phase');
          const opts = {
            phase: phaseIdx !== -1 ? parseInt(args[phaseIdx + 1], 10) : null,
            escalated: args.includes('--escalated'),
          };
          ledger.cmdLedgerList(cwd, runId, opts, raw);
          break;
        }
        default:
          process.stderr.write(`ledger: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'mailbox': {
      const sub = args[1];
      const runId = args[2];

      switch (sub) {
        case 'append': {
          // mailbox append <run-id> --data <json>
          // runId may be a run-id or '--data' if user omitted run-id (env fallback)
          let effectiveRunId = runId;
          let dataIdx;
          if (runId === '--data') {
            // no explicit run-id; env fallback path
            effectiveRunId = undefined;
            dataIdx = args.indexOf('--data');
          } else {
            dataIdx = args.indexOf('--data');
          }
          const jsonString = dataIdx !== -1 ? args[dataIdx + 1] : null;
          if (!jsonString) {
            process.stderr.write('mailbox append <run-id> --data <json>\n');
            process.exit(1);
          }
          mailbox.cmdMailboxAppend(cwd, effectiveRunId, jsonString);
          break;
        }
        case 'list': {
          // mailbox list <run-id> [--status <status>] [--raw]
          const statusIdx = args.indexOf('--status');
          const opts = {
            status: statusIdx !== -1 ? args[statusIdx + 1] : null,
          };
          mailbox.cmdMailboxList(cwd, runId, opts, raw);
          break;
        }
        case 'answer': {
          // mailbox answer [run-id] --id q-NNN --answer "text"
          let effectiveRunId = runId;
          if (runId === '--id' || runId === '--answer') effectiveRunId = undefined;
          const idIdx = args.indexOf('--id');
          const ansIdx = args.indexOf('--answer');
          mailbox.cmdMailboxAnswer(cwd, effectiveRunId,
            idIdx !== -1 ? args[idIdx + 1] : null,
            ansIdx !== -1 ? args[ansIdx + 1] : null);
          break;
        }
        case 'review': {
          // mailbox review [run-id]
          let effectiveRunId = runId;
          if (effectiveRunId && effectiveRunId.startsWith('--')) effectiveRunId = undefined;
          mailbox.cmdMailboxReview(cwd, effectiveRunId);
          break;
        }
        default:
          process.stderr.write(`mailbox: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'park': {
      const sub = args[1];
      // run-id is args[2] unless it starts with '--' (env fallback path)
      let runId = args[2];
      if (runId && runId.startsWith('--')) runId = undefined;

      // Flag parsing
      const phaseIdx = args.indexOf('--phase');
      const phase = phaseIdx !== -1 ? parseInt(args[phaseIdx + 1], 10) : null;
      const questionIdx = args.indexOf('--question');
      const question = questionIdx !== -1 ? args[questionIdx + 1] : null;
      const blockedAtIdx = args.indexOf('--blocked-at');
      const blockedAt = blockedAtIdx !== -1 ? args[blockedAtIdx + 1] : null;
      const resumeIdx = args.indexOf('--resume');
      const resume = resumeIdx !== -1 ? args[resumeIdx + 1] : null;
      const phaseDirIdx = args.indexOf('--phase-dir');
      const phaseDir = phaseDirIdx !== -1 ? args[phaseDirIdx + 1] : null;
      const contextPathIdx = args.indexOf('--context-path');
      const contextPath = contextPathIdx !== -1 ? args[contextPathIdx + 1] : null;

      switch (sub) {
        case 'create':
          park.cmdParkCreate(cwd, runId, { phase, question, blockedAt, resume, phaseDir, contextPath });
          break;
        case 'staleness':
          park.cmdParkStaleness(cwd, runId, { phase }, raw);
          break;
        default:
          process.stderr.write(`park: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'triage': {
      const sub = args[1];
      // run-id is args[2] unless it starts with '--' (env fallback)
      let runId = args[2];
      if (runId && runId.startsWith('--')) runId = undefined;

      switch (sub) {
        case 'run':
          Promise.resolve(triage.cmdTriageRun(cwd, runId)).catch(e => {
            process.stderr.write((e.message || String(e)) + '\n');
            process.exit(1);
          });
          break;
        default:
          process.stderr.write(`triage: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'run': {
      const sub = args[1];

      switch (sub) {
        case 'init': {
          const initRunId = args[2] || process.env.GSD_RUN_ID;
          ledger.cmdRunInit(cwd, initRunId);
          break;
        }
        case 'snapshot': {
          // run snapshot <run-id> --phase N
          let runId = args[2];
          if (runId && runId.startsWith('--')) runId = undefined;
          const phaseIdx = args.indexOf('--phase');
          const phase = phaseIdx !== -1 ? parseInt(args[phaseIdx + 1], 10) : null;
          park.cmdRunSnapshot(cwd, runId, { phase });
          break;
        }
        case 'record-phase': {
          let runId = args[2];
          if (runId && runId.startsWith('--')) runId = undefined;
          const flag = (name) => { const i = args.indexOf(name); return i !== -1 ? args[i + 1] : undefined; };
          const phaseRaw = flag('--phase');
          const mergeRaw = flag('--merge-clean');
          ledger.cmdRunRecordPhase(cwd, runId, {
            phase: phaseRaw != null ? parseInt(phaseRaw, 10) : null,
            status: flag('--status') || null,
            worktree: flag('--worktree') || null,
            mergeClean: mergeRaw === 'true' ? true : mergeRaw === 'false' ? false : null,
            startedTs: flag('--started-ts') || null,
            endedTs: flag('--ended-ts') || null,
            reason: flag('--reason') || null,
          });
          break;
        }
        case 'status': {
          let runId = args[2];
          if (runId && runId.startsWith('--')) runId = undefined;
          const setIdx = args.indexOf('--set');
          const reasonIdx = args.indexOf('--reason');
          ledger.cmdRunStatus(cwd, runId, setIdx !== -1 ? args[setIdx + 1] : null, reasonIdx !== -1 ? args[reasonIdx + 1] : null);
          break;
        }
        case 'report': {
          let runId = args[2];
          if (runId && runId.startsWith('--')) runId = undefined;
          ledger.cmdRunReport(cwd, runId);
          break;
        }
        default:
          process.stderr.write(`run: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'discuss-loop': {
      const sub = args[1];

      switch (sub) {
        case 'loop-id': {
          // discuss-loop loop-id <artifact-ref>
          discussLoop.cmdLoopId(cwd, args[2]);
          break;
        }
        case 'validate': {
          // discuss-loop validate --round N --data <json> [--prior <json>] [--artifact <path>]
          const roundIdx = args.indexOf('--round');
          const dataIdx = args.indexOf('--data');
          const priorIdx = args.indexOf('--prior');
          const artifactIdx = args.indexOf('--artifact');
          discussLoop.cmdValidate(cwd, {
            round: roundIdx !== -1 ? args[roundIdx + 1] : null,
            jsonString: dataIdx !== -1 ? args[dataIdx + 1] : null,
            priorJson: priorIdx !== -1 ? args[priorIdx + 1] : null,
            artifactPath: artifactIdx !== -1 ? args[artifactIdx + 1] : null,
          });
          break;
        }
        case 'delta': {
          // discuss-loop delta --round N --data <json array> [--degraded]
          const roundIdx = args.indexOf('--round');
          const dataIdx = args.indexOf('--data');
          discussLoop.cmdDelta(cwd, {
            round: roundIdx !== -1 ? args[roundIdx + 1] : null,
            jsonString: dataIdx !== -1 ? args[dataIdx + 1] : null,
            degraded: args.includes('--degraded'),
          });
          break;
        }
        case 'survivors': {
          // discuss-loop survivors --data <json array of rounds>
          const dataIdx = args.indexOf('--data');
          discussLoop.cmdSurvivors(cwd, dataIdx !== -1 ? args[dataIdx + 1] : null);
          break;
        }
        case 'transcript': {
          // discuss-loop transcript <loop-id> --data <record json>
          const dataIdx = args.indexOf('--data');
          discussLoop.cmdTranscript(cwd, args[2], dataIdx !== -1 ? args[dataIdx + 1] : null);
          break;
        }
        default:
          process.stderr.write(`discuss-loop: unknown subcommand: ${sub}\n`);
          process.exit(1);
      }
      break;
    }

    case 'graph': {
      const sub = args[1];
      if (sub === 'analyze') {
        graph.cmdGraphAnalyze(cwd, raw);
      } else if (sub === 'export') {
        graph.cmdGraphExport(cwd, raw);
      } else if (sub === 'validate') {
        const strict = args.includes('--strict');
        graph.cmdGraphValidate(cwd, { strict }, raw);
      } else if (sub === 'blast-radius') {
        const nodeId = args[2];
        if (!nodeId) {
          error('graph blast-radius requires a <node> argument, e.g. gsd-tools graph blast-radius phase:17');
        }
        const depthIdx = args.indexOf('--depth');
        const depth = depthIdx !== -1 ? parseInt(args[depthIdx + 1], 10) : null;
        graph.cmdGraphBlastRadius(cwd, nodeId, { depth }, raw);
      } else {
        error('Unknown graph subcommand. Available: analyze, export, validate, blast-radius');
      }
      break;
    }

    default:
      error(`Unknown command: ${command}`);
  }
}

main();
