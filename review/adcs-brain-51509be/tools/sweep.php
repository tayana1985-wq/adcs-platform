<?php
// Пересчёт таблицы планирования: обе стороны дискретны, четыре конструкции связи,
// плюс две величины, которых в отчётах нет — натяжение и потолок мощности.
$B=__DIR__.'/cp/adcs-brain/src/Analytics/';
require $B.'Statistics.php'; require $B.'TieAwarePower2.php'; require $B.'TieAwarePower3.php';
use Adcs\Analytics\TieAwarePower3 as T3;

$RHO=0.1724; $REPS=3200;
$bel=[0.0060,0.0483,0.3742,0.2918,0.2797];
$scen=[
 'EQUAL_THIRDS'    =>[1/3,1/3,1/3],
 'CEILING_SKEW'    =>[0.100,0.200,0.700],
 'FLOOR_SKEW'      =>[0.700,0.200,0.100],
 'NEAR_DEGENERATE' =>[0.050,0.100,0.850],
 'ALMOST_CONSTANT' =>[0.005,0.005,0.990],
 'POLYGON_ACCESS'  =>[0.0336,0.6415,0.3249],
 'POLYGON_COMMUN'  =>[0.0302,0.6226,0.3472],
];
$fam=[1=>0.05,2=>0.025,3=>1/60];
$t=new T3(20260828);
$out=fopen(__DIR__.'/sweep_out.txt','w');
fwrite($out,"сценарий           сем  модель                                 параметр  потолок  натяж.  N      мощн.   невыполн.\n");
foreach($scen as $name=>$sx){
  $ceil=T3::rhoOfProb(T3::comonotone($sx,$bel));
  foreach([1,2] as $f){
    foreach(T3::MODELS as $m){
      $c=$t->cellsFor($m,$sx,$bel,$RHO);
      if($c===null){fwrite($out,sprintf("%-18s %-4d %-38s %-9s %.4f  %.3f   недостижимо\n",$name,$f,$m,'—',$ceil,$RHO/$ceil));continue;}
      $r=$t->requiredN($c['cells'],$fam[$f],0.80,$REPS,$name,$f);
      $n=$r['n_certified']??($r['n_point']??null);
      $ne=null;
      if($n!==null){ $s=$t->seedFor('audit',$name,$f,$n);
        $q=$t->rejectionTraced($n,$c['cells'],$fam[$f],$REPS,$s); $ne=$q['not_executable_share']; }
      fwrite($out,sprintf("%-18s %-4d %-38s %-9.4f %.4f  %.3f   %-6s %-7s %s\n",
        $name,$f,$m,$c['param'],$ceil,$RHO/$ceil,$n??'—',
        isset($r['power'])?round($r['power'],4):'—',$ne===null?'—':round($ne,4)));
      fflush($out);
    }
  }
}
fwrite($out,"\nготово\n"); fclose($out);
