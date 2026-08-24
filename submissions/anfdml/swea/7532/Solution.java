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
			int S = sc.nextInt();
			int E = sc.nextInt();
			int M = sc.nextInt();
			int year = S;
			
			while(true) {
				if((year-E)%24 == 0 && (year -M) % 29 ==0) {
					
					
					break;
				}
				year += 365;
			}
			
			System.out.println("#"+test_case+" "+year);
		}
	}
}