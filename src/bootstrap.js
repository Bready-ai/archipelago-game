const boot = window.__pustoshBoot;
boot.setStage('game-modules');
import('./main.js').catch(error => boot.fail(error, { phase: boot.report.phase }));
