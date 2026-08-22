import java.util.Iterator;
import java.util.Scanner;

class Solution
{
	public static void main(String args[]) throws Exception
	{
		
		Scanner sc = new Scanner(System.in);
		int T;
		T=sc.nextInt();
		
		for(int test_case = 1; test_case <= T; test_case++)
		{
			int N = sc.nextInt();
			int A = sc.nextInt();
			int B = sc.nextInt();
			int min = 0;
			int max = 0;
			
			if(A+B>N) {
				min=(A+B)-N;
			}
			if(A>B) {
				max = B;
			}else {
				max =A;
			}
			System.out.println("#"+test_case+ " "+ max+" "+ min);
			
			
		}
		
	}
}
