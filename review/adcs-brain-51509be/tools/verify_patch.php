<?php
$B=__DIR__.'/cp/adcs-brain/src/Analytics/';
require $B.'Statistics.php'; require $B.'TieAwarePower2.php'; require $B.'TieAwarePower3.php';
use Adcs\Analytics\TieAwarePower3 as T3;
$bel=[0.0060,0.0483,0.3742,0.2918,0.2797];
$scen=['EQUAL_THIRDS'=>[1/3,1/3,1/3],'POLYGON_ACCESS'=>[0.0336,0.6415,0.3249],
       'NEAR_DEGENERATE'=>[0.050,0.100,0.850],'ALMOST_CONSTANT'=>[0.005,0.005,0.990]];
$t=new T3(20260828);
printf("%-17s %-8s %-7s %-7s %-6s %s\n",'сценарий','натяж.','невып.','N расч.','N плана','вердикт');
foreach($scen as $n=>$sx){
  $c=$t->cellsFor(T3::MODEL_GAUSSIAN,$sx,$bel,0.1724);
  $r=$t->requiredN($c['cells'],0.05,0.80,3200,$n,1,$c['strain']);
  printf("%-17s %-8.3f %-7.4f %-7s %-6s %s\n",$n,$c['strain'],$r['not_executable_share'],
    $r['n_certified']??'—',$r['planning_n']===null?'ОТКАЗ':$r['planning_n'],$r['precision']);
}
