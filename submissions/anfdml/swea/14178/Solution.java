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
			int N =sc.nextInt();
			int D =sc.nextInt();
			int ans = 0;
			if(N%(D*2 +1)==0) {
				ans = N/(D*2 +1);
			}else {
				ans = N/(D*2 +1) +1;
			}
			//D*2 +1 을 N 으로 나눴을 때 나머지가 0 이면 몫이 답 아니면 몫 + 1
			
			System.out.println("#"+test_case+" "+ ans);
		}
	}
}
