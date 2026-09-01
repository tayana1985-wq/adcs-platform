<?php
$B=__DIR__.'/cp/adcs-brain/src/Analytics/';
require $B.'Statistics.php'; require $B.'TieAwarePower2.php'; require $B.'TieAwarePower3.php';
use Adcs\Analytics\TieAwarePower3 as T3;
$bel=[0.0060,0.0483,0.3742,0.2918,0.2797];
$scen=['EQUAL_THIRDS'=>[1/3,1/3,1/3],'ALMOST_CONSTANT'=>[0.005,0.005,0.990]];
$t=new T3(20260828);
foreach($scen as $name=>$sx){
  echo "\n== $name ==\n";
  foreach(T3::MODELS as $m){
    $c=$t->cellsFor($m,$sx,$bel,0.1724);
    if($c===null){printf("  %-38s недостижимо\n",$m);continue;}
    $r=$t->requiredN($c['cells'],0.05,0.80,3200,$name,1);
    printf("  %-38s параметр=%.4f  N=%-6s мощн=%s\n",$m,$c['param'],$r['n_certified']??($r['n_point']??'—'),
      isset($r['power'])?round($r['power'],4):'—');
  }
}
