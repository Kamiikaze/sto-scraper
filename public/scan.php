<?php
$files = glob('data/*.json');
$files = array_reverse($files);
echo json_encode($files);

?>
