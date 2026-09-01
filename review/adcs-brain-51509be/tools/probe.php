<?php
$B='/tmp/claude-0/-home-user-adcs-platform/c647f978-452b-59ec-b0bc-eaabf574f96d/scratchpad/cp/adcs-brain/src/Analytics/';
require $B.'Statistics.php'; require $B.'TieAwarePower2.php';
use Adcs\Analytics\TieAwarePower2;

$belonging = [0.0060,0.0483,0.3742,0.2918,0.2797];
$scen = ['EQUAL_THIRDS'=>[1/3,1/3,1/3],'ALMOST_CONSTANT'=>[0.005,0.005,0.990],
         'POLYGON_PROXY'=>[0.0336,0.6415,0.3249]];
$t = new TieAwarePower2(20260828);
echo str_pad('сценарий',18)." скрытая r   поп.Спирмен  N конс.  N точ.  мощн.   доля вырожденных выборок при N\n";
foreach ($scen as $name=>$sx) {
    $r = $t->calibrate($sx,$belonging,0.1724);
    if ($r===null) { echo "$name: цель недостижима\n"; continue; }
    $cells = TieAwarePower2::cellProbabilities($sx,$belonging,$r);
    $res = $t->requiredN($cells,0.05,0.80,6400,$name,1);
    $n = $res['n_conservative'] ?? $res['n_point'];
    // вероятность, что весь столбец нового вопроса окажется одной категорией
    $degen = 0.0; foreach ($sx as $p) { $degen += $p ** $n; }
    printf("%-18s %.6f     %.4f      %-8s %-7s %.4f  %.4f\n",
      $name, $r, $t->populationRho($sx,$belonging,$r),
      $res['n_conservative']??'—', $res['n_point']??'—', $res['power'], $degen);
}
