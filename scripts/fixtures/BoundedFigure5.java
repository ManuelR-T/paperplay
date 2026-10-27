import java.util.Random;
import java.util.Arrays;
import wildinter.net.mergesort.*;
public class BoundedFigure5 {
 public static void main(String[] args) {
  final int n=1<<24; final long seed=248442268L;
  Sorter[] algorithms={new PowerSort(true,false,24),new PeekSort(24,false),new TopDownMergesort(24,true),TimsortTrot.INSTANCE};
  for(Sorter algorithm:algorithms) {
   Random random=new Random(seed);
   int[] input=null;
   for(int repetition=0;repetition<3;repetition++) {
    input=Inputs.timsortDragGenerator(32).next(n,random,input);
    MergesAndRuns.totalMergeCosts=0;
    algorithm.sort(input,0,n-1);
    if(!Util.isSorted(input))throw new AssertionError("Unsorted author output");
    long cost=MergesAndRuns.totalMergeCosts;
    System.out.println("{\"algorithm\":\""+algorithm.toString()+"\",\"n\":"+n+",\"seed\":"+seed+",\"repetition\":"+repetition+",\"mergeCost\":"+cost+",\"sorted\":true}");
   }
  }
 }
}
